const { generateSpinParameters } = require('./wheel');

// Configuration
const NUM_TESTS = 1000;
const NUM_SEGMENTS = 5; // Can be changed to any number
const SEGMENT_ANGLE = 360 / NUM_SEGMENTS;

// Function to calculate Chi-square critical value using Wilson-Hilferty approximation
function calculateChiSquareCritical(degreesOfFreedom, significanceLevel) {
    // Using Wilson-Hilferty approximation
    const z = significanceLevel === 0.05 ? 1.645 : 2.326; // z-scores for 0.05 and 0.01
    const v = degreesOfFreedom;
    const chiSquare = v * Math.pow(1 - (2/(9*v)) + (z * Math.sqrt(2/(9*v))), 3);
    return chiSquare;
}

// Calculate critical values based on degrees of freedom (NUM_SEGMENTS - 1)
const degreesOfFreedom = NUM_SEGMENTS - 1;
const CHI_SQUARE_CRITICAL_05 = calculateChiSquareCritical(degreesOfFreedom, 0.05);
const CHI_SQUARE_CRITICAL_01 = calculateChiSquareCritical(degreesOfFreedom, 0.01);

// Storage for results
const stopAngleDistribution = {};
const segmentDistribution = {};

// Run tests
for (let i = 0; i < NUM_TESTS; i++) {
    const result = generateSpinParameters(NUM_SEGMENTS);
    
    // Round stop angle to nearest degree for binning
    const roundedAngle = Math.round(result.stopAngle);
    stopAngleDistribution[roundedAngle] = (stopAngleDistribution[roundedAngle] || 0) + 1;
    
    // Track segment distribution
    segmentDistribution[result.winningSegment] = (segmentDistribution[result.winningSegment] || 0) + 1;
}

// Analyze results
console.log('\n=== Test Results ===');
console.log(`Total runs: ${NUM_TESTS}`);

// Segment Distribution Analysis
console.log('\nSegment Distribution:');
for (let i = 1; i <= NUM_SEGMENTS; i++) {
    const count = segmentDistribution[i] || 0;
    const percentage = ((count / NUM_TESTS) * 100).toFixed(2);
    console.log(`Segment ${i}: ${count} times (${percentage}%)`);
}

// Calculate statistics
const segmentCounts = Object.values(segmentDistribution);
const expectedCount = NUM_TESTS / NUM_SEGMENTS;
const variance = segmentCounts.reduce((acc, count) => acc + Math.pow(count - expectedCount, 2), 0) / NUM_SEGMENTS;
const stdDev = Math.sqrt(variance);

console.log('\nStatistical Analysis:');
console.log(`Expected count per segment: ${expectedCount}`);
console.log(`Standard Deviation: ${stdDev.toFixed(2)}`);
console.log(`Coefficient of Variation: ${((stdDev / expectedCount) * 100).toFixed(2)}%`);

// Chi-square test for uniformity
const chiSquare = segmentCounts.reduce((acc, count) => acc + Math.pow(count - expectedCount, 2) / expectedCount, 0);
console.log(`\nChi-square Analysis:`);
console.log(`Degrees of Freedom: ${degreesOfFreedom}`);
console.log(`Critical value (5% significance): ${CHI_SQUARE_CRITICAL_05.toFixed(2)}`);
console.log(`Critical value (1% significance): ${CHI_SQUARE_CRITICAL_01.toFixed(2)}`);
console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);

// Chi-square interpretation
console.log('\nChi-square Interpretation:');
if (chiSquare < CHI_SQUARE_CRITICAL_05) {
    console.log('✅ Distribution appears uniform (no significant deviation detected)');
} else if (chiSquare < CHI_SQUARE_CRITICAL_01) {
    console.log('⚠️ Distribution shows some significant deviation from uniform');
} else {
    console.log('❌ Distribution shows highly significant deviation from uniform');
}
