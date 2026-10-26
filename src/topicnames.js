// Kid-friendly names for the question topics (the skills panel and reports show these instead of the internal ids).
export const TOPIC_NAMES = {
  multiply: 'Multiplying', divide: 'Dividing', equivalentFractions: 'Equivalent fractions', perimeterArea: 'Perimeter and area', roundDecimals: 'Rounding decimals', negative: 'Negative numbers',
  placeValue: 'Place value', addSub: 'Adding and subtracting', factors: 'Factors and multiples', fractionOfAmount: 'Fractions of an amount', units: 'Units and measures', time: 'Time', volume: 'Volume',
  solve: 'Solving equations', ratio: 'Ratio', expand: 'Expanding brackets', fdp: 'Fractions, decimals, percentages', neg: 'Negative numbers', angles: 'Angles', orderOps: 'Order of operations',
  percentOf: 'Percentages of amounts', collect: 'Collecting like terms', sequences: 'Sequences', meanMedian: 'Mean and median', areaTriangle: 'Area of a triangle',
};
export const topicName = (id) => TOPIC_NAMES[id] || String(id).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
