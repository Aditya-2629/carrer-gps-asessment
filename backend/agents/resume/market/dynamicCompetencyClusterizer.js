/**
 * dynamicCompetencyClusterizer.js
 * 100% Dynamic Statistical & Semantic Clustering Engine (Zero-Hardcoding)
 * Pure ES Module Implementation
 */

class DynamicCompetencyClusterizer {
  constructor() {
    // Regex for interchangeable linguistic patterns: "A or B", "A / B", "either A or B", "one of: A, B"
    this.disjunctivePatterns = [
      /\b([a-zA-Z0-9+#.\-_]{2,30})\s+(?:or|\/)\s+([a-zA-Z0-9+#.\-_]{2,30})\b/gi,
      /(?:either|proficiency in|experience with|one of:?)\s+([a-zA-Z0-9+#.\-_]{2,30})\s+(?:or|,)\s+([a-zA-Z0-9+#.\-_]{2,30})/gi
    ];
  }

  /**
   * Generates a clean, professional human-readable title for a cluster
   * @param {Array<string>} tools 
   * @returns {string}
   */
  formatClusterTitle(tools = []) {
    if (!tools || tools.length === 0) return 'Core Competency';
    const capitalize = (str) =>
      str
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    if (tools.length === 1) {
      return `${capitalize(tools[0])} Proficiency`;
    }
    const mainTools = tools.slice(0, 3).map(capitalize).join(' / ');
    return `${mainTools} Competency`;
  }

  /**
   * Scans JD texts and dynamically builds an adjacency graph of interchangeable tools.
   * @param {Array<string>} jdTexts 
   * @param {Set<string>} knownSkills 
   * @returns {{ adj: Map<string, Set<string>>, frequency: Map<string, number> }}
   */
  mineDisjunctiveGraph(jdTexts = [], knownSkills = new Set()) {
    const adj = new Map();
    const frequency = new Map();
    const normalize = (s) => s.trim().toLowerCase();

    const recordFreq = (item) => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    };

    const addEdge = (u, v) => {
      if (!adj.has(u)) adj.set(u, new Set());
      if (!adj.has(v)) adj.set(v, new Set());
      adj.get(u).add(v);
      adj.get(v).add(u);
    };

    const isSkill = (token) => {
      const norm = normalize(token);
      if (knownSkills.size === 0) return norm.length >= 2;
      return knownSkills.has(norm);
    };

    for (const text of jdTexts) {
      if (!text || typeof text !== 'string') continue;

      for (const pattern of this.disjunctivePatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const s1 = normalize(match[1]);
          const s2 = normalize(match[2]);

          if (s1 !== s2 && isSkill(s1) && isSkill(s2)) {
            addEdge(s1, s2);
            recordFreq(s1);
            recordFreq(s2);
          }
        }
      }
    }

    return { adj, frequency };
  }

  /**
   * Resolves connected graph components using BFS.
   * @param {Map<string, Set<string>>} adjGraph 
   * @param {Map<string, number>} frequencyMap 
   * @param {Array<string>} allSkills 
   * @returns {Array<Array<string>>}
   */
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
      const norm = (typeof skill === 'string' ? skill : skill.name || '').trim().toLowerCase();
      if (norm && !visited.has(norm)) {
        visited.add(norm);
        clusters.push([norm]);
      }
    }

    return clusters;
  }

  /**
   * Evaluates candidate coverage: 100% credit if ANY interchangeable tool is matched.
   * @param {Array<Array<string>>} clusters 
   * @param {Array<string>} candidateVerifiedSkills 
   * @returns {Object}
   */
  evaluateCandidateCoverage(clusters = [], candidateVerifiedSkills = []) {
    const candidateSet = new Set(
      Array.from(candidateVerifiedSkills).map((s) =>
        (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase()
      ).filter(Boolean)
    );

    const totalClusters = clusters.length;
    let satisfiedClusters = 0;
    const clusterBreakdown = [];

    for (const clusterTools of clusters) {
      const matchedTools = clusterTools.filter((tool) => candidateSet.has(tool));
      const isSatisfied = matchedTools.length > 0;

      if (isSatisfied) {
        satisfiedClusters += 1;
      }

      const clusterTitle = this.formatClusterTitle(clusterTools);

      clusterBreakdown.push({
        clusterName: clusterTitle,
        cluster_title: clusterTitle,
        interchangeableGroup: clusterTools,
        satisfied: isSatisfied,
        matchedTools,
        matched_member: matchedTools.join(', ') || 'None',
        creditScore: isSatisfied ? 1.0 : 0.0,
        recommendation: isSatisfied
          ? `Verified via ${matchedTools.join(', ')} (Satisfies competency group).`
          : `Missing equivalent tools. Consider gaining proficiency in at least one: ${clusterTools.slice(0, 3).join(', ')}.`,
        verdict: isSatisfied
          ? `Candidate demonstrated ${matchedTools.join(', ')} which satisfies this competency requirement.`
          : `Missing interchangeable tools in this cluster (${clusterTools.slice(0, 3).join(', ')}).`
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

  /**
   * Main entrypoint
   */
  processDynamicClustering({ jdTexts = [], rawSkills = [], candidateSkills = [] }) {
    const normalizedSkills = rawSkills
      .map((s) => (typeof s === 'string' ? s : s?.name || ''))
      .filter(Boolean);
    const skillSet = new Set(normalizedSkills.map((s) => s.trim().toLowerCase()));

    const { adj, frequency } = this.mineDisjunctiveGraph(jdTexts, skillSet);
    const clusters = this.buildClustersFromGraph(adj, frequency, normalizedSkills);
    const evaluation = this.evaluateCandidateCoverage(clusters, candidateSkills);

    return {
      clusters,
      evaluation
    };
  }
}

const dynamicCompetencyClusterizer = new DynamicCompetencyClusterizer();
export default dynamicCompetencyClusterizer;
export { DynamicCompetencyClusterizer };
