/**
 * Crafture Brand Person 3D SDF Mascot for Wobnimo
 *
 * Silhouette: Tailored executive diagnostic guide in dark tailored blazer,
 * crisp white V-collar shirt, electric indigo tie, and signature ascending career bar.
 */

export const crafturePerson = {
  id: 'crafture-person',
  name: 'Crafture Guide',
  tagline: 'Tailored executive career guide in dark blazer and indigo tie',
  accent: '#6366F1',
  frame: { target: 0.46, radius: 0.65 },
  bound: { y: 0.44, radius: 0.68 },
  motion: { hop: 0.14, squash: 1.15, snap: 1.05, talkSquash: 0.6 },

  materials: {
    figure: {
      color: '#141720',
      f0: 0.06,
      spec: 0.9,
      shininess: 90,
      rim: 0.85,
      gloss: 0.65,
    },
    blazer: {
      color: '#1E293B',
      f0: 0.04,
      spec: 0.5,
      shininess: 45,
      rim: 0.65,
      sheen: 0.35,
    },
    collar: {
      color: '#F8FAFC',
      f0: 0.03,
      spec: 0.4,
      shininess: 30,
      rim: 0.5,
    },
    tie: {
      color: '#6366F1',
      f0: 0.05,
      spec: 0.9,
      shininess: 85,
      rim: 0.7,
      gloss: 0.5,
    },
    barAccent: {
      color: '#10B981',
      f0: 0.05,
      spec: 0.8,
      shininess: 70,
      rim: 0.6,
      emit: '#10B981',
      emitStrength: 0.2,
    },
    shoes: {
      color: '#090D16',
      f0: 0.08,
      spec: 1.1,
      shininess: 120,
      rim: 0.4,
      gloss: 0.8,
    },
  },

  bones: [
    {
      name: 'body',
      pivot: [0, 0, 0],
      drive: { ry: [['yaw', 0.22]], rz: [['roll', 0.3]] },
    },
    {
      name: 'head',
      parent: 'body',
      pivot: [0, 0.42, 0],
      drive: { rx: [['pitch', -0.75]], ry: [['yaw', 0.7]], rz: [['roll', 0.6]] },
    },
    {
      name: 'armL',
      parent: 'body',
      pivot: [-0.22, 0.36, 0],
      drive: { rz: [['flap', -0.6]] },
    },
    {
      name: 'armR',
      parent: 'body',
      pivot: [0.22, 0.36, 0],
      drive: { rz: [['flap', 0.6]] },
    },
    {
      name: 'badge',
      parent: 'body',
      pivot: [0.12, 0.32, 0.16],
      jiggle: { axis: [0, 1, 0], length: 0.08, freq: 3.2, damping: 0.2 },
    },
  ],

  parts: [
    /* 1. Body & Tailored Blazer */
    {
      bone: 'body',
      shape: 'roundBox',
      at: [0, 0.24, 0],
      half: [0.2, 0.17, 0.15],
      round: 0.12,
      material: 'blazer',
    },
    /* Crisp White Shirt V-Placket */
    {
      bone: 'body',
      shape: 'plate',
      at: [0, 0.31, 0.155],
      half: [0.065, 0.08],
      corner: 0.02,
      depth: 0.008,
      material: 'collar',
    },
    /* Electric Indigo Tie */
    {
      bone: 'body',
      shape: 'capsule',
      from: [0, 0.34, 0.165],
      to: [0, 0.2, 0.16],
      radius: 0.022,
      material: 'tie',
    },
    /* Signature Ascending Career Bar Accent on Lapel */
    {
      bone: 'badge',
      shape: 'roundBox',
      at: [-0.02, 0, 0],
      half: [0.006, 0.018, 0.006],
      round: 0.004,
      material: 'barAccent',
    },
    {
      bone: 'badge',
      shape: 'roundBox',
      at: [0, 0.006, 0],
      half: [0.006, 0.026, 0.006],
      round: 0.004,
      material: 'barAccent',
    },
    {
      bone: 'badge',
      shape: 'roundBox',
      at: [0.02, 0.014, 0],
      half: [0.006, 0.034, 0.006],
      round: 0.004,
      material: 'barAccent',
    },

    /* 2. Arms & Hands */
    {
      bone: 'armL',
      shape: 'capsule',
      from: [0, 0, 0],
      to: [-0.04, -0.16, 0.04],
      radius: 0.042,
      material: 'blazer',
    },
    {
      bone: 'armL',
      shape: 'sphere',
      at: [-0.05, -0.2, 0.05],
      radius: 0.038,
      material: 'figure',
    },
    {
      bone: 'armR',
      shape: 'capsule',
      from: [0, 0, 0],
      to: [0.04, -0.16, 0.04],
      radius: 0.042,
      material: 'blazer',
    },
    {
      bone: 'armR',
      shape: 'sphere',
      at: [0.05, -0.2, 0.05],
      radius: 0.038,
      material: 'figure',
    },

    /* 3. Dress Shoes */
    {
      bone: 'body',
      shape: 'roundBox',
      at: [-0.1, 0.035, 0.04],
      half: [0.055, 0.035, 0.09],
      round: 0.03,
      material: 'shoes',
    },
    {
      bone: 'body',
      shape: 'roundBox',
      at: [0.1, 0.035, 0.04],
      half: [0.055, 0.035, 0.09],
      round: 0.03,
      material: 'shoes',
    },

    /* 4. Sleek Executive Head */
    {
      bone: 'head',
      shape: 'ellipsoid',
      at: [0, 0.17, 0],
      radii: [0.22, 0.22, 0.21],
      material: 'figure',
    },
  ],

  paints: [
    /* Soft ambient blush / cheek reflex */
    {
      bone: 'head',
      on: ['figure'],
      kind: 'sphere',
      at: [-0.14, 0.11, 0.17],
      radius: 0.04,
      color: '#6366F1',
      soft: 0.5,
      opacity: 0.35,
    },
    {
      bone: 'head',
      on: ['figure'],
      kind: 'sphere',
      at: [0.14, 0.11, 0.17],
      radius: 0.04,
      color: '#6366F1',
      soft: 0.5,
      opacity: 0.35,
    },
  ],

  eyes: {
    kind: 'ball',
    bone: 'head',
    at: [
      [-0.08, 0.18, 0.18],
      [0.08, 0.18, 0.18],
    ],
    radius: 0.048,
    iris: '#6366F1',
    irisSize: 0.85,
    pupilSize: 0.52,
    lid: 'figure',
  },

  face: {
    kind: 'mouth',
    bone: 'head',
    on: ['figure'],
    at: [0, 0.08, 0.21],
    width: 0.04,
    color: '#1A0C14',
    tongue: '#F43F5E',
  },

  anchors: {
    top: { bone: 'head', at: [0, 0.4, 0.02] },
    mouth: { bone: 'head', at: [0, 0.06, 0.22] },
    ear: { bone: 'head', at: [-0.22, 0.17, 0] },
    feet: { bone: 'root', at: [0, 0.02, 0.05] },
  },

  acting: {
    thinking: {
      head: { rz: 0.14, rx: 0.06 },
    },
    listening: {
      head: { rz: -0.12, rx: -0.04 },
    },
    speaking: {
      head: { rx: [0, 0.06, 3.2, 0] },
    },
    celebrating: {
      head: { rx: -0.12 },
      armL: { rz: -1.2 },
      armR: { rz: 1.2 },
    },
    error: {
      head: { rz: 0.2, rx: 0.08 },
    },
  },
}

export default crafturePerson
