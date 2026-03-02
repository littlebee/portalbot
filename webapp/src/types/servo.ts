/**
 * Configuration parameters for a single servo motor.
 */
export interface IServoConfig {
    /** Servo identifier name (e.g., "pan", "tilt") */
    name: string;

    /** Minimum angle in degrees */
    min_angle: number;

    /** Maximum angle in degrees */
    max_angle: number;
}

export interface IServoConfigByName {
    [key: string]: IServoConfig;
}
