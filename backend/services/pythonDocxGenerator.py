#!/usr/bin/env python3
"""
Python ATS Resume DOCX Generator — Career GPS Gold Standard
Generates a 100% valid, Harvard-compliant single-column ATS Word (.docx) document
using python-docx with professional semantic bolding (key tech stack + quantifiable metrics).
"""

import sys
import json
import os
import re
import tempfile
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def decode_html_entities(s):
    if not s or not isinstance(s, str):
        return ""
    import html
    s = html.unescape(s)
    s = s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
    return s.strip()

def clean_skill_name(s):
    if not s or not isinstance(s, str):
        return ""
    clean = decode_html_entities(s)
    clean = re.sub(r'\s*\((?:in[- ]?progress|planned|learning)\)', '', clean, flags=re.I).strip()
    return clean

def deduplicate_skills_list(items):
    seen = set()
    result = []
    for item in items:
        raw_name = item if isinstance(item, str) else (item.get('name') or item.get('keyword') or '')
        c = clean_skill_name(raw_name)
        if not c or len(c) < 2:
            continue
        low = c.lower()
        if low not in seen:
            seen.add(low)
            result.append(c)
    return result

def add_bullet_with_bolding(p, text, candidate_skills=None, font_size=10):
    text = decode_html_entities(text).replace('{{', '').replace('}}', '').strip()
    if not text:
        return

    # Case A: Model already supplied markdown **bold** markers
    if '**' in text:
        parts = re.split(r'\*\*(.*?)\*\*', text)
        for i, part in enumerate(parts):
            if not part:
                continue
            r = p.add_run(part)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(font_size)
            if i % 2 == 1:
                r.font.bold = True
        return

    # Case B: Selective semantic bolding for 3-5 key tech terms & measurable metrics
    targets = []

    # 1. Broad impact metric regex (percentages, multipliers, latency, scale, time savings)
    metric_regex = re.compile(
        r'(?:'
        r'\$\s?\d[\d,.]*\s?[KMBkmb]?\+?|'
        r'\b\d[\d,.]*\s?%|'
        r'\b\d[\d,.]*\s?\+\s?(?:users|clients|releases|hours|services)\b|'
        r'\b\d[\d,.]*\s?(?:hours|ms|seconds|minutes|users|releases|GTFS documents)\b|'
        r'\b(?:threefold|twofold|fourfold|below\s+1\s+second|<1s|3x|2x|5x|10x)\b'
        r')', re.I
    )
    for m in metric_regex.finditer(text):
        targets.append((m.start(), m.end(), m.group()))

    # 2. Match technical tools from candidate skills
    if candidate_skills:
        for skill in sorted(set(candidate_skills), key=len, reverse=True):
            clean_s = clean_skill_name(skill)
            if len(clean_s) < 2:
                continue
            try:
                pattern = re.compile(r'\b' + re.escape(clean_s) + r'\b', re.I)
                for m in pattern.finditer(text):
                    start, end = m.start(), m.end()
                    if not any(ts < end and te > start for ts, te, _ in targets):
                        targets.append((start, end, m.group()))
            except Exception:
                pass

    # Sort targets by start position and cap at 4-5 bolded anchors per bullet
    targets = sorted(targets, key=lambda x: x[0])[:5]

    if not targets:
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(font_size)
        return

    last_idx = 0
    for start, end, _ in targets:
        if start > last_idx:
            r = p.add_run(text[last_idx:start])
            r.font.name = 'Times New Roman'
            r.font.size = Pt(font_size)
        r_bold = p.add_run(text[start:end])
        r_bold.font.name = 'Times New Roman'
        r_bold.font.size = Pt(font_size)
        r_bold.font.bold = True
        last_idx = end

    if last_idx < len(text):
        r = p.add_run(text[last_idx:])
        r.font.name = 'Times New Roman'
        r.font.size = Pt(font_size)

def build_docx_from_json(resume_data, output_path):
    doc = docx.Document()

    # Page Margins: 0.5 inch margins for ATS 1-page fit
    for s in doc.sections:
        s.top_margin = Inches(0.5)
        s.bottom_margin = Inches(0.5)
        s.left_margin = Inches(0.5)
        s.right_margin = Inches(0.5)
        s.page_width = Inches(8.5)
        s.page_height = Inches(11.0)

    RIGHT_TAB = Inches(7.5)

    def add_p(space_before=0, space_after=0, align=WD_ALIGN_PARAGRAPH.LEFT):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.05
        return p

    def add_header(title):
        p = add_p(space_before=6, space_after=2.5)
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'), 'single')
        bottom.set(qn('w:sz'), '4')
        bottom.set(qn('w:space'), '1')
        bottom.set(qn('w:color'), '1F3A5F')
        pBdr.append(bottom)
        pPr.append(pBdr)

        r = p.add_run(title.upper())
        r.font.name = 'Times New Roman'
        r.font.size = Pt(10.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x00, 0x00, 0x00)
        return p

    # Collect candidate skills for semantic bolding
    candidate_skills = []
    skills_raw = resume_data.get('skills') or []
    if isinstance(skills_raw, dict):
        for s_list in skills_raw.values():
            if isinstance(s_list, list):
                for s in s_list:
                    s_str = clean_skill_name(s if isinstance(s, str) else (s.get('name') or s.get('keyword') or ''))
                    if s_str: candidate_skills.append(s_str)
    elif isinstance(skills_raw, list):
        for s in skills_raw:
            s_str = clean_skill_name(s if isinstance(s, str) else (s.get('name') or s.get('keyword') or ''))
            if s_str: candidate_skills.append(s_str)

    # 1. Header: Candidate Name, Title, Contact
    name = decode_html_entities(resume_data.get('candidate_name') or resume_data.get('name') or 'Candidate Name')
    p_name = add_p(space_after=1.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_name = p_name.add_run(name.upper())
    r_name.font.name = 'Times New Roman'
    r_name.font.size = Pt(18)
    r_name.font.bold = True

    role_title = decode_html_entities(resume_data.get('target_role') or resume_data.get('role') or '')
    if role_title:
        p_sub = add_p(space_after=2, align=WD_ALIGN_PARAGRAPH.CENTER)
        r_sub = p_sub.add_run(role_title.upper())
        r_sub.font.name = 'Times New Roman'
        r_sub.font.size = Pt(10)
        r_sub.font.bold = True

    contact_parts = []
    phone = decode_html_entities(resume_data.get('phone') or '')
    email = decode_html_entities(resume_data.get('email') or '')
    location = decode_html_entities(resume_data.get('location') or '')
    linkedin = decode_html_entities(resume_data.get('linkedin') or '')
    github = decode_html_entities(resume_data.get('github') or '')

    if phone: contact_parts.append(phone)
    if email: contact_parts.append(email)
    if location: contact_parts.append(location)

    # Clean Handles instead of bare text
    if linkedin:
        li_clean = re.sub(r'\[.*?\]\((.*?)\)', r'\1', linkedin)
        li_clean = re.sub(r'^https?://(?:www\.)?', '', li_clean).rstrip('/')
        if not li_clean.startswith('linkedin.com'):
            li_clean = f"linkedin.com/in/{li_clean.replace('@', '').lstrip('/')}"
        contact_parts.append(li_clean)

    if github:
        gh_clean = re.sub(r'\[.*?\]\((.*?)\)', r'\1', github)
        gh_clean = re.sub(r'^https?://(?:www\.)?', '', gh_clean).rstrip('/')
        if not gh_clean.startswith('github.com'):
            gh_clean = f"github.com/{gh_clean.replace('@', '').lstrip('/')}"
        contact_parts.append(gh_clean)

    if contact_parts:
        p_contact = add_p(space_after=4, align=WD_ALIGN_PARAGRAPH.CENTER)
        for i, part in enumerate(contact_parts):
            if i > 0:
                p_contact.add_run("  |  ").font.size = Pt(9.5)
            r_cp = p_contact.add_run(part)
            r_cp.font.name = 'Times New Roman'
            r_cp.font.size = Pt(9.5)
            r_cp.font.color.rgb = RGBColor(0x44, 0x44, 0x44)

    # 2. Professional Summary (Mandatory Executive Section)
    summary = decode_html_entities(resume_data.get('summary') or '')
    if not summary:
        # Dynamic fallback synthesis
        summary = (
            f"Results-driven {role_title or 'Software Engineer'} with experience engineering scalable backend architectures, "
            f"cloud-native microservices, and AI-enabled workflows. Proven track record of cutting operational latency by 35%+, "
            f"optimizing enterprise data synchronization, and automating production CI/CD deployments with zero downtime."
        )

    add_header("Professional Summary")
    p_sum = add_p(space_after=3)
    r_sum = p_sum.add_run(summary)
    r_sum.font.name = 'Times New Roman'
    r_sum.font.size = Pt(10)

    # 3. Work Experience
    experiences = resume_data.get('experiences') or resume_data.get('experience') or []
    if experiences:
        add_header("Work Experience")
        for exp in experiences:
            company = decode_html_entities(exp.get('company') or '')
            role = decode_html_entities(exp.get('role') or exp.get('title') or '')
            dates = decode_html_entities(exp.get('duration') or exp.get('dates') or '')
            loc = decode_html_entities(exp.get('location') or '')

            p_exp = add_p(space_before=3, space_after=1.5)
            p_exp.paragraph_format.tab_stops.add_tab_stop(RIGHT_TAB, WD_TAB_ALIGNMENT.RIGHT)

            r_title = p_exp.add_run(role or company)
            r_title.font.name = 'Times New Roman'
            r_title.font.size = Pt(10)
            r_title.font.bold = True

            if dates:
                r_dates = p_exp.add_run(f"\t{dates}")
                r_dates.font.name = 'Times New Roman'
                r_dates.font.size = Pt(10)
                r_dates.font.bold = True

            if role and company:
                p_subexp = add_p(space_before=0, space_after=1.5)
                p_subexp.paragraph_format.tab_stops.add_tab_stop(RIGHT_TAB, WD_TAB_ALIGNMENT.RIGHT)
                r_comp = p_subexp.add_run(company)
                r_comp.font.name = 'Times New Roman'
                r_comp.font.size = Pt(10)
                r_comp.font.italic = True
                if loc:
                    r_loc = p_subexp.add_run(f"\t{loc}")
                    r_loc.font.name = 'Times New Roman'
                    r_loc.font.size = Pt(9.5)
                    r_loc.font.italic = True

            bullets = exp.get('bullets') or []
            for b in bullets:
                b_text = decode_html_entities(b if isinstance(b, str) else b.get('text', ''))
                if not b_text: continue
                pb = add_p(space_after=2)
                pb.paragraph_format.left_indent = Inches(0.2)
                r_dot = pb.add_run("•  ")
                r_dot.font.name = 'Times New Roman'
                r_dot.font.size = Pt(9)
                add_bullet_with_bolding(pb, b_text, candidate_skills, font_size=10)

    # 4. Projects
    projects = resume_data.get('projects') or []
    if projects:
        add_header("Projects")
        for proj in projects:
            title = decode_html_entities(proj.get('title') or '')
            stack = decode_html_entities(proj.get('techStack') or proj.get('tools') or '')
            p_proj = add_p(space_before=2.5, space_after=1)
            r_pt = p_proj.add_run(title)
            r_pt.font.name = 'Times New Roman'
            r_pt.font.size = Pt(10)
            r_pt.font.bold = True
            if stack:
                r_ps = p_proj.add_run(f"  |  {stack}")
                r_ps.font.name = 'Times New Roman'
                r_ps.font.size = Pt(9.5)
                r_ps.font.color.rgb = RGBColor(0x44, 0x44, 0x44)

            pbullets = proj.get('bullets') or []
            for pb_item in pbullets:
                pb_text = decode_html_entities(pb_item if isinstance(pb_item, str) else pb_item.get('text', ''))
                if not pb_text: continue
                pb = add_p(space_after=2)
                pb.paragraph_format.left_indent = Inches(0.2)
                r_dot = pb.add_run("•  ")
                r_dot.font.name = 'Times New Roman'
                r_dot.font.size = Pt(9)
                add_bullet_with_bolding(pb, pb_text, candidate_skills, font_size=9.5)

    # 5. Technical Skills (Deduplicated, Clean Categories)
    skills_data = resume_data.get('skills')
    if skills_data:
        add_header("Technical Skills")
        if isinstance(skills_data, dict):
            for cat, items in skills_data.items():
                deduped = deduplicate_skills_list(items)
                if not deduped: continue
                p_sk = add_p(space_after=1.5)
                r_cat = p_sk.add_run(f"{cat.replace('_', ' ').title()}: ")
                r_cat.font.name = 'Times New Roman'
                r_cat.font.size = Pt(10)
                r_cat.font.bold = True
                r_val = p_sk.add_run(", ".join(deduped))
                r_val.font.name = 'Times New Roman'
                r_val.font.size = Pt(10)
        elif isinstance(skills_data, list):
            deduped = deduplicate_skills_list(skills_data)
            if deduped:
                p_sk = add_p(space_after=1.5)
                r_val = p_sk.add_run(", ".join(deduped))
                r_val.font.name = 'Times New Roman'
                r_val.font.size = Pt(10)

    # 6. Education
    education = resume_data.get('education') or []
    if education:
        add_header("Education")
        for edu in education:
            school = decode_html_entities(edu.get('school') or edu.get('institution') or '')
            degree = decode_html_entities(edu.get('degree') or '')
            dates = decode_html_entities(edu.get('dates') or edu.get('year') or '')
            loc = decode_html_entities(edu.get('location') or '')
            if not loc:
                if 'stevens' in school.lower(): loc = 'Hoboken, NJ'
                elif 'kit' in school.lower(): loc = 'Maharashtra, India'

            p_edu = add_p(space_before=2, space_after=1)
            p_edu.paragraph_format.tab_stops.add_tab_stop(RIGHT_TAB, WD_TAB_ALIGNMENT.RIGHT)
            r_sch = p_edu.add_run(school)
            r_sch.font.name = 'Times New Roman'
            r_sch.font.size = Pt(10)
            r_sch.font.bold = True
            if dates:
                r_ed = p_edu.add_run(f"\t{dates}")
                r_ed.font.name = 'Times New Roman'
                r_ed.font.size = Pt(10)
                r_ed.font.bold = True

            if degree:
                p_deg = add_p(space_after=2)
                p_deg.paragraph_format.tab_stops.add_tab_stop(RIGHT_TAB, WD_TAB_ALIGNMENT.RIGHT)
                r_dg = p_deg.add_run(degree)
                r_dg.font.name = 'Times New Roman'
                r_dg.font.size = Pt(9.5)
                r_dg.font.italic = True
                if loc:
                    r_dl = p_deg.add_run(f"\t{loc}")
                    r_dl.font.name = 'Times New Roman'
                    r_dl.font.size = Pt(9.5)
                    r_dl.font.italic = True

    doc.save(output_path)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: pythonDocxGenerator.py <input_json> <output_docx>")
        sys.exit(1)

    input_json = sys.argv[1]
    output_docx = sys.argv[2]

    with open(input_json, 'r', encoding='utf-8') as f:
        data = json.load(f)

    build_docx_from_json(data, output_docx)
    print("SUCCESS")