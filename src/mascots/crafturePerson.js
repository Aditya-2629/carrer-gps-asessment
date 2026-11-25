/**
 * Crafture Brand Executive 3D SDF Mascot for Wobnimo
 *
 * Proportion: 5.5-head tailored executive figure matching the exact proportions,
 * height, and color palette of Mascot Presenting Growing Analytics:
 * - Head & Hands: Matte charcoal (#2B2D30) smooth finish, clean featureless sphere (no robot eyes)
 * - Blazer: Forest Green (#1B4D3E) with emerald accent (#15803D)
 * - Shirt & Cuffs: Crisp white (#FFFFFF) V-collar and sleeve cuffs
 * - Tie: Forest/Emerald Green (#15803D)
 * - Trousers: Elongated dark charcoal (#1F2421)
 * - Shoes: Matte black (#141414)
 */

export const crafturePerson = {
  id: 'crafture-person',
  name: 'Crafture Guide',
  tagline: 'Tailored executive career guide in forest green blazer and matte charcoal finish',
  accent: '#1B4D3E',
  frame: { target: 0.36, radius: 0.58 },
  bound: { y: 0.35, radius: 0.60 },
  motion: { hop: 0.14, squash: 1.15, snap: 1.05, talkSquash: 0.6 },

  materials: {
    figure: {
      color: '#2B2D30',
      f0: 0.04,
      spec: 0.35,
      shininess: 35,
      rim: 0.35,
      gloss: 0.25,
    },
    blazer: {
      color: '#1B4D3E',
      f0: 0.04,
      spec: 0.45,
      shininess: 40,
      rim: 0.5,
      sheen: 0.3,
      accent: '#15803D',
    },
    collar: {
      color: '#FFFFFF',
      f0: 0.03,
      spec: 0.35,
      shininess: 30,
      rim: 0.4,
    },
    tie: {
      color: '#15803D',
      f0: 0.04,
      spec: 0.5,
      shininess: 50,
      rim: 0.5,
      gloss: 0.4,
    },
    trousers: {
      color: '#1F2421',
      f0: 0.04,
      spec: 0.35,
      shininess: 35,
      rim: 0.35,
    },
    shoes: {
      color: '#141414',
      f0: 0.06,
      spec: 0.5,
      shininess: 60,
      rim: 0.3,
      gloss: 0.4,
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
      pivot: [0, 0.48, 0],
      drive: { rx: [['pitch', -0.75]], ry: [['yaw', 0.7]], rz: [['roll', 0.6]] },
    },
    {
      name: 'armL',
      parent: 'body',
      pivot: [-0.17, 0.42, 0],
      drive: { rz: [['flap', -0.6]] },
    },
    {
      name: 'armR',
      parent: 'body',
      pivot: [0.17, 0.42, 0],
      drive: { rz: [['flap', 0.6]] },
    },
  ],

  parts: [
    /* 1. Tailored Forest Green Blazer (Slim 5.5-Head Executive Cut) */
    {
      bone: 'body',
      shape: 'roundBox',
      at: [0, 0.30, 0],
      half: [0.16, 0.19, 0.12],
      round: 0.08,
      material: 'blazer',
    },
    /* Crisp White V-Placket Collar */
    {
      bone: 'body',
      shape: 'plate',
      at: [0, 0.38, 0.122],
      half: [0.052, 0.065],
      corner: 0.02,
      depth: 0.008,
      material: 'collar',
    },
    /* Emerald/Forest Green Tie */
    {
      bone: 'body',
      shape: 'capsule',
      from: [0, 0.41, 0.13],
      to: [0, 0.23, 0.125],
      radius: 0.018,
      material: 'tie',
    },

    /* 2. Elongated Dark Charcoal Trousers (5.5-Head Proportions) */
    {
      bone: 'body',
      shape: 'capsule',
      from: [-0.07, 0.14, 0],
      to: [-0.07, -0.06, 0],
      radius: 0.038,
      material: 'trousers',
    },
    {
      bone: 'body',
      shape: 'capsule',
      from: [0.07, 0.14, 0],
      to: [0.07, -0.06, 0],
      radius: 0.038,
      material: 'trousers',
    },

    /* 3. Matte Black Dress Shoes */
    {
      bone: 'body',
      shape: 'roundBox',
      at: [-0.07, -0.095, 0.02],
      half: [0.042, 0.025, 0.07],
      round: 0.02,
      material: 'shoes',
    },
    {
      bone: 'body',
      shape: 'roundBox',
      at: [0.07, -0.095, 0.02],
      half: [0.042, 0.025, 0.07],
      round: 0.02,
      material: 'shoes',
    },

    /* 4. Arms, White Shirt Cuffs & Matte Charcoal Hands */
    {
      bone: 'armL',
      shape: 'capsule',
      from: [0, 0, 0],
      to: [-0.035, -0.18, 0.025],
      radius: 0.034,
      material: 'blazer',
    },
    /* Left White Shirt Cuff */
    {
      bone: 'armL',
      shape: 'capsule',
      from: [-0.035, -0.18, 0.025],
      to: [-0.042, -0.21, 0.03],
      radius: 0.032,
      material: 'collar',
    },
    /* Left Hand (Matte Charcoal) */
    {
      bone: 'armL',
      shape: 'sphere',
      at: [-0.048, -0.24, 0.035],
      radius: 0.030,
      material: 'figure',
    },

    {
      bone: 'armR',
      shape: 'capsule',
      from: [0, 0, 0],
      to: [0.035, -0.18, 0.025],
      radius: 0.034,
      material: 'blazer',
    },
    /* Right White Shirt Cuff */
    {
      bone: 'armR',
      shape: 'capsule',
      from: [0.035, -0.18, 0.025],
      to: [0.042, -0.21, 0.03],
      radius: 0.032,
      material: 'collar',
    },
    /* Right Hand (Matte Charcoal) */
    {
      bone: 'armR',
      shape: 'sphere',
      at: [0.048, -0.24, 0.035],
      radius: 0.030,
      material: 'figure',
    },

    /* 5. Clean Featureless Matte Charcoal Sphere Head (NO robot eyes) */
    {
      bone: 'head',
      shape: 'ellipsoid',
      at: [0, 0.16, 0],
      radii: [0.165, 0.175, 0.155],
      material: 'figure',
    },
  ],

  anchors: {
    top: { bone: 'head', at: [0, 0.36, 0.02] },
    mouth: { bone: 'head', at: [0, 0.06, 0.18] },
    ear: { bone: 'head', at: [-0.18, 0.16, 0] },
    feet: { bone: 'body', at: [0, -0.09, 0.02] },
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
