// Mock D3.js for testing network visualization
export const mockD3 = {
  // Selection mock
  select: jest.fn().mockReturnThis(),
  selectAll: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  html: jest.fn().mockReturnThis(),
  classed: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  ease: jest.fn().mockReturnThis(),
  each: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  datum: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  exit: jest.fn().mockReturnThis(),
  merge: jest.fn().mockReturnThis(),
  
  // Mock zoom
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    transform: jest.fn()
  })),
  
  // Mock drag
  drag: jest.fn(() => ({
    on: jest.fn().mockReturnThis()
  })),
  
  // Mock force simulation
  forceSimulation: jest.fn(() => ({
    force: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    nodes: jest.fn().mockReturnThis(),
    alpha: jest.fn().mockReturnThis(),
    alphaTarget: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    tick: jest.fn()
  })),
  
  // Mock forces
  forceLink: jest.fn(() => ({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis()
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn().mockReturnThis()
  })),
  forceCenter: jest.fn(() => ({})),
  forceCollide: jest.fn(() => ({
    radius: jest.fn().mockReturnThis()
  })),
  
  // Mock scales
  scaleOrdinal: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  })),
  scaleLinear: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  })),
  scaleSqrt: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  })),
  
  // Mock color schemes
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c'],
  
  // Mock event
  event: {
    target: {},
    x: 100,
    y: 100,
    transform: { k: 1, x: 0, y: 0 }
  },
  
  // Mock zoom transform
  zoomIdentity: { k: 1, x: 0, y: 0 },
  zoomTransform: jest.fn(() => ({ k: 1, x: 0, y: 0 })),
  
  // Mock CSV/data loading
  csv: jest.fn().mockResolvedValue([]),
  json: jest.fn().mockResolvedValue({}),
  
  // Mock other utilities
  extent: jest.fn(() => [0, 100]),
  max: jest.fn(() => 100),
  min: jest.fn(() => 0),
  sum: jest.fn(() => 100),
  mean: jest.fn(() => 50),
  
  // Mock pie chart
  pie: jest.fn(() => ({
    value: jest.fn().mockReturnThis()
  })),
  
  // Mock arc
  arc: jest.fn(() => ({
    outerRadius: jest.fn().mockReturnThis(),
    innerRadius: jest.fn().mockReturnThis()
  })),
  
  // Mock line
  line: jest.fn(() => ({
    x: jest.fn().mockReturnThis(),
    y: jest.fn().mockReturnThis(),
    curve: jest.fn().mockReturnThis()
  })),
  
  // Mock axes
  axisBottom: jest.fn(() => ({
    scale: jest.fn().mockReturnThis(),
    ticks: jest.fn().mockReturnThis(),
    tickFormat: jest.fn().mockReturnThis()
  })),
  axisLeft: jest.fn(() => ({
    scale: jest.fn().mockReturnThis(),
    ticks: jest.fn().mockReturnThis(),
    tickFormat: jest.fn().mockReturnThis()
  }))
};

// Mock D3 as global
global.d3 = mockD3;

export default mockD3;