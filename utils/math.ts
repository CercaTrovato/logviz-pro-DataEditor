
// A simple seeded random number generator (Linear Congruential Generator)
// to ensure reproducibility of "jitter" operations.
export class SeededRandom {
    private seed: number;
  
    constructor(seed: number) {
      this.seed = seed;
    }
  
    // Returns number between 0 and 1
    next(): number {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
  
    // Box-Muller transform for Gaussian distribution
    nextGaussian(mean: number = 0, std: number = 1): number {
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return num * std + mean;
    }
  }
  
  // Easing functions for interpolation
  export const Easing = {
    Linear: (t: number) => t,
    EaseInQuad: (t: number) => t * t,
    EaseOutQuad: (t: number) => t * (2 - t),
    EaseInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    EaseInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  };
  
  // Format a number to match the precision of a reference string
  // e.g. target=0.1234, ref="0.5000" -> "0.1234"
  // e.g. target=0.1, ref="0.5000" -> "0.1000"
  export const formatToMatch = (value: number, referenceStr: string): string => {
    if (isNaN(value)) return referenceStr;
    
    // Check if reference is scientific notation
    if (referenceStr.toLowerCase().includes('e')) {
        return value.toExponential(6); // Default to 6 for scientific if undetectable
    }
  
    if (referenceStr.includes('.')) {
      const decimals = referenceStr.split('.')[1].length;
      return value.toFixed(decimals);
    }
    
    // Integer or unknown
    return Math.round(value).toString();
  };
