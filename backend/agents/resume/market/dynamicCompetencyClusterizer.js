/**
 * dynamicCompetencyClusterizer.js
 * 100% Dynamic Statistical & Semantic Clustering Engine (Zero-Hardcoding)
 * Pure ES Module Implementation
 */

export class DynamicCompetencyClusterizer {
  constructor() {
    this.disjunctiveSplitRegex = /\s*(?:\bor\b|\/|\|)\s*/gi;

    this.disjunctivePatterns = [
      /\b([a-zA-Z0-9+#.\-_]{2,30})\s+(?:or|\/|\|)\s+([a-zA-Z0-9+#.\-_]{2,30})\b/gi,
      /(?:either|proficiency in|experience with|hands-on with|knowledge of|one of:?|such as)\s+([a-zA-Z0-9+#.\-_]{2,30})\s+(?:or|,|\/)\s+([a-zA-Z0-9+#.\-_]{2,30})/gi,
      /\b([a-zA-Z0-9+#.\-_]{2,30})\s*,\s*([a-zA-Z0-9+#.\-_]{2,30})\s+(?:or|\/)\s+([a-zA-Z0-9+#.\-_]{2,30})\b/gi
    ];

    this.stopWords = new Set([
      'and', 'or', 'the', 'is', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by',
      'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'years',
      'year', 'experience', 'equivalent', 'degree', 'bachelor', 'bachelors',
      'master', 'masters', 'minimum', 'plus', 'preferred', 'required', 'responsibilities',
      'qualification', 'qualifications', 'ability', 'abilities', 'demonstrated',
      'related', 'field', 'work', 'working', 'similar', 'environment'
    ]);
  }

  capitalizeWord(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    return trimmed
      .split(/\s+/)
      .map((w) => {
        if (/^(sql|aws|gcp|etl|crm|erp|bi|emr|ehr|sap|ci\/cd|api|apis|ml|ai|pm|qa|wms|tms|k8s)$/i.test(w)) {
          return w.toUpperCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }

  formatClusterTitle(tools = [], dynamicLabel = null) {
    if (dynamicLabel && typeof dynamicLabel === 'string' && dynamicLabel.trim().length > 0) {
      return dynamicLabel.trim();
    }
    if (!tools || tools.length === 0) return 'Core Systems';

    if (tools.length === 1) {
      return `${this.capitalizeWord(tools[0])} Systems`;
    }
    const mainTools = tools.slice(0, 3).map((t) => this.capitalizeWord(t)).join(' / ');
    return `${mainTools} Systems`;
  }

  resolveTokenFromSnippet(snippet, fromEnd, knownSkills) {
    if (!snippet || typeof snippet !== 'string') return null;
    const clean = snippet
      .replace(/[,;:!?()[\]{}"'“”‘’]/g, ' ')
      .replace(/\.(?=\s|$)/g, ' ')
      .replace(/[^\w\s+#.\-_]/g, ' ')
      .trim();
    const words = clean
      .split(/\s+/)
      .map((w) => w.replace(/^[^a-zA-Z0-9+#]+|[^a-zA-Z0-9+#]+$/g, ''))
      .filter(Boolean);
    if (words.length === 0) return null;

    if (fromEnd) {
      for (let len = Math.min(3, words.length); len >= 1; len--) {
        const candidate = words.slice(words.length - len).join(' ').toLowerCase();
        if (knownSkills && knownSkills.has(candidate)) return candidate;
      }
      const lastWord = words[words.length - 1].toLowerCase();
      if (!this.stopWords.has(lastWord) && lastWord.length >= 2 && !/^\d+$/.test(lastWord)) {
        return lastWord;
      }
    } else {
      for (let len = Math.min(3, words.length); len >= 1; len--) {
        const candidate = words.slice(0, len).join(' ').toLowerCase();
        if (knownSkills && knownSkills.has(candidate)) return candidate;
      }
      const firstWord = words[0].toLowerCase();
      if (!this.stopWords.has(firstWord) && firstWord.length >= 2 && !/^\d+$/.test(firstWord)) {
        return firstWord;
      }
    }
    return null;
  }

  mineDisjunctiveGraph(jdTexts = [], knownSkills = new Set()) {
    const adj = new Map();
    const frequency = new Map();
    const normalize = (s) => (s || '').trim().toLowerCase();

    const recordFreq = (item) => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    };

    const addEdge = (u, v) => {
      if (!u || !v || u === v) return;
      if (!adj.has(u)) adj.set(u, new Set());
      if (!adj.has(v)) adj.set(v, new Set());
      adj.get(u).add(v);
      adj.get(v).add(u);
    };

    const isSkill = (token) => {
      const norm = normalize(token);
      if (norm.length < 2 || this.stopWords.has(norm) || /^\d+$/.test(norm)) return false;
      if (knownSkills && knownSkills.size > 0) {
        return knownSkills.has(norm);
      }
      return true;
    };

    for (const text of jdTexts) {
      if (!text || typeof text !== 'string') continue;

      this.disjunctiveSplitRegex.lastIndex = 0;
      let match;
      while ((match = this.disjunctiveSplitRegex.exec(text)) !== null) {
        const beforeIndex = match.index;
        const afterIndex = match.index + match[0].length;

        const beforeSnippet = text.slice(Math.max(0, beforeIndex - 40), beforeIndex);
        const afterSnippet = text.slice(afterIndex, Math.min(text.length, afterIndex + 40));

        const s1 = this.resolveTokenFromSnippet(beforeSnippet, true, knownSkills);
        const s2 = this.resolveTokenFromSnippet(afterSnippet, false, knownSkills);

        if (s1 && s2 && s1 !== s2 && isSkill(s1) && isSkill(s2)) {
          addEdge(s1, s2);
          recordFreq(s1);
          recordFreq(s2);
        }
      }

      for (const pattern of this.disjunctivePatterns) {
        pattern.lastIndex = 0;
        let pMatch;
        while ((pMatch = pattern.exec(text)) !== null) {
          const s1 = normalize(pMatch[1]);
          const s2 = normalize(pMatch[2]);
          const s3 = pMatch[3] ? normalize(pMatch[3]) : null;

          if (s1 && s2 && s1 !== s2 && isSkill(s1) && isSkill(s2)) {
            addEdge(s1, s2);
            recordFreq(s1);
            recordFreq(s2);
          }

          if (s3 && s3 !== s1 && s3 !== s2 && isSkill(s3)) {
            addEdge(s2, s3);
            recordFreq(s3);
          }
        }
      }
    }

    return { adj, frequency };
  }

  buildClustersFromGraph(adjGraph, frequencyMap, allSkills = []) {
    const visited = new Set();
    const clusters = [];

    const traverse = (startNode) => {
      const clusterMembers = [startNode];
      const queue = [startNode];
      visited.add(startNode);

      while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = adjGraph.get(curr) || [];
        for (const nxt of neighbors) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            clusterMembers.push(nxt);
            queue.push(nxt);
          }
        }
      }

      clusterMembers.sort((a, b) => (frequencyMap.get(b) || 0) - (frequencyMap.get(a) || 0));
      return clusterMembers;
    };

    for (const node of adjGraph.keys()) {
      if (!visited.has(node)) {
        clusters.push(traverse(node));
      }
    }

    for (const skill of allSkills) {
      const norm = (typeof skill === 'string' ? skill : skill?.name || skill?.skill || '').trim().toLowerCase();
      if (norm && !visited.has(norm) && !this.stopWords.has(norm)) {
        visited.add(norm);
        clusters.push([norm]);
      }
    }

    return clusters;
  }

  evaluateCandidateCoverage(clusters = [], candidateVerifiedSkills = [], dynamicLabels = {}) {
    const candidateSet = new Set(
      Array.from(candidateVerifiedSkills).map((s) =>
        (typeof s === 'string' ? s : s?.name || s?.skill || s?.keyword || '').trim().toLowerCase()
      ).filter(Boolean)
    );

    const totalClusters = clusters.length;
    let satisfiedClusters = 0;
    const clusterBreakdown = [];

    for (const clusterTools of clusters) {
      const matchedTools = clusterTools.filter((tool) => candidateSet.has(tool.toLowerCase()));
      const isSatisfied = matchedTools.length > 0;

      if (isSatisfied) {
        satisfiedClusters += 1;
      }

      const clusterKey = clusterTools.map((t) => t.toLowerCase()).sort().join('::');
      const dynamicLabel = dynamicLabels[clusterKey] || dynamicLabels[clusterTools[0]?.toLowerCase()];
      const clusterTitle = this.formatClusterTitle(clusterTools, dynamicLabel);

      const matchedDisplay = matchedTools.map((t) => this.capitalizeWord(t)).join(', ');
      const optionsDisplay = clusterTools.slice(0, 3).map((t) => this.capitalizeWord(t)).join(', ');

      clusterBreakdown.push({
        clusterName: clusterTitle,
        cluster_title: clusterTitle,
        interchangeableGroup: clusterTools,
        satisfied: isSatisfied,
        matchedTools,
        matched_member: matchedDisplay || 'None',
        matchedTool: matchedDisplay || 'None',
        creditScore: isSatisfied ? 1.0 : 0.0,
        recommendation: isSatisfied
          ? `Verified via ${matchedDisplay} (Satisfies ${clusterTitle} requirement).`
          : `Missing equivalent tools. Consider gaining proficiency in at least one: ${optionsDisplay}.`,
        verdict: isSatisfied
          ? `Candidate demonstrated ${matchedDisplay} which satisfies this competency requirement.`
          : `Missing interchangeable tools in this cluster (${optionsDisplay}).`
      });
    }

    const coverageRatio = totalClusters > 0 ? satisfiedClusters / totalClusters : 1.0;

    return {
      totalClusters,
      satisfiedClusters,
      coveragePercentage: Math.round(coverageRatio * 100),
      clusterBreakdown
    };
  }

  processDynamicClustering({ jdTexts = [], rawSkills = [], candidateSkills = [], dynamicLabels = {} } = {}) {
    const normalizedSkills = (rawSkills || [])
      .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || s?.keyword || ''))
      .map((s) => s.trim())
      .filter(Boolean);
    const skillSet = new Set(normalizedSkills.map((s) => s.toLowerCase()));

    const { adj, frequency } = this.mineDisjunctiveGraph(jdTexts, skillSet);
    const clusters = this.buildClustersFromGraph(adj, frequency, normalizedSkills);
    const evaluation = this.evaluateCandidateCoverage(clusters, candidateSkills, dynamicLabels);

    return {
      clusters,
      evaluation
    };
  }
}

const dynamicCompetencyClusterizer = new DynamicCompetencyClusterizer();
export default dynamicCompetencyClusterizer;
