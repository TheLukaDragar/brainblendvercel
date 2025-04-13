/**
 * Calculates the level based on XP using an exponential formula
 * @param xp The user's current XP
 * @returns The calculated level
 */
export function calculateLevel(xp: number): number {
    // Base XP required for level 1
    const baseXP = 100;
    // Growth factor - higher values make leveling up harder
    const growthFactor = 1.5;
    
    // Calculate level using the formula: level = floor(log_growthFactor(xp/baseXP + 1)) + 1
    const level = Math.floor(Math.log(xp / baseXP + 1) / Math.log(growthFactor)) + 1;
    
    // Ensure minimum level is 1
    return Math.max(1, level);
}

/**
 * Calculates the XP required to reach a specific level
 * @param level The target level
 * @returns The XP required to reach that level
 */
export function xpForLevel(level: number): number {
    const baseXP = 100;
    const growthFactor = 1.5;
    
    // Calculate XP using the formula: xp = baseXP * (growthFactor^(level-1) - 1)
    return Math.floor(baseXP * (Math.pow(growthFactor, level - 1) - 1));
}

/**
 * Calculates the progress to next level (0-100)
 * @param currentXP The user's current XP
 * @returns Progress percentage to next level
 */
export function calculateProgressToNextLevel(currentXP: number): number {
    const currentLevel = calculateLevel(currentXP);
    const xpForCurrentLevel = xpForLevel(currentLevel);
    const xpForNextLevel = xpForLevel(currentLevel + 1);
    
    const xpInCurrentLevel = currentXP - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    
    // Ensure we don't return more than 100% progress
    return Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNextLevel) * 100));
} 