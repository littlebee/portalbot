/*

This component was hoisted from basic_bot_react repository.  I decided not
to use any of the basic_bot_react components, because they rely on having
a direct connection to the basic_bot central hub.   Portalbot webapp does not
have a direct connection from the webapp to the central hub, because the
robot is possibly behind a firewall or NAT and unreachable.

All comm between the webapp and the robot goes through the public_server
herein.   Public server will validate, sanitize and relay messages to the
robot.

*/

import { useCallback, useMemo, useState } from "react";

import st from "./PanTilt.module.css";

import type { IServoConfig } from "@/types/servo";

const TOUCH_GRID_SIZE = 200;
const ANGLE_INDICATOR_RADIUS = 10;

export interface PanTiltProps {
    /** Servo configuration defining pan and tilt servo parameters */
    panConfig: IServoConfig;
    tiltConfig: IServoConfig;
    /** Currently set servo servoAngles */
    panAngle: number;
    tiltAngle: number;
    /** Callback function called when servo servoAngles change */
    onAngleChange?: (panAngle: number, tiltAngle: number) => void;
}

/**
 * A touchscreen joystick for controlling pan and tilt servos.
 *
 * This component provides an interactive 2D control interface for adjusting
 * camera pan and tilt servos. Users can click or touch anywhere on the control
 * grid to set target servoAngles. Visual indicators show both target and actual
 * servo positions. Requires servo configuration with servos named "pan" and "tilt".
 *
 * Can be used with or without HubStateProvider:
 * - With props: Pass servoConfig, servoAngles, and servoActualAngles directly
 * - With provider: Wrap in HubStateProvider and props will be automatically populated
 */
export function PanTilt({
    panConfig,
    tiltConfig,
    panAngle,
    tiltAngle,
    onAngleChange,
}: PanTiltProps) {
    const [angleX, angleY]: [number, number] = useMemo(() => {
        return mapPanTiltToXYSquare(
            panAngle,
            panConfig,
            tiltAngle,
            tiltConfig,
            TOUCH_GRID_SIZE,
            ANGLE_INDICATOR_RADIUS,
        );
    }, [panAngle, tiltAngle, panConfig, tiltConfig]);

    const [fingerDown, setFingerDown] = useState(false);

    const sendXYToPanTilt = useCallback(
        (x: number, y: number) => {
            const [newPanAngle, newTiltAngle] = mapXYToPanTilt(
                x,
                y,
                panConfig,
                tiltConfig,
                TOUCH_GRID_SIZE,
            );
            onAngleChange?.(newPanAngle, newTiltAngle);
        },
        [panConfig, tiltConfig, onAngleChange],
    );

    const mouseEventToXY = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            return [x, y];
        },
        [],
    );

    const touchEventToXY = useCallback(
        (event: React.TouchEvent<HTMLDivElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.touches[0].clientX - rect.left;
            const y = event.touches[0].clientY - rect.top;
            return [x, y];
        },
        [],
    );

    const handleMouseDown = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const [x, y] = mouseEventToXY(event);
            sendXYToPanTilt(x, y);
            setFingerDown(true);
        },
        [sendXYToPanTilt],
    );

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!fingerDown) {
                return;
            }
            const [x, y] = mouseEventToXY(event);
            sendXYToPanTilt(x, y);
        },
        [fingerDown, mouseEventToXY, sendXYToPanTilt],
    );

    const handleMouseUp = useCallback(() => {
        setFingerDown(false);
    }, []);

    const handleTouchStart = useCallback(
        (event: React.TouchEvent<HTMLDivElement>) => {
            const [x, y] = touchEventToXY(event);
            sendXYToPanTilt(x, y);
        },
        [sendXYToPanTilt],
    );

    const handleTouchMove = useCallback(
        (event: React.TouchEvent<HTMLDivElement>) => {
            const [x, y] = touchEventToXY(event);
            sendXYToPanTilt(x, y);
        },
        [touchEventToXY, sendXYToPanTilt],
    );

    const handleTouchEnd = useCallback(() => {
        setFingerDown(false);
    }, []);

    const handleTouchCancel = useCallback(() => {
        setFingerDown(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setFingerDown(false);
    }, []);

    return (
        <div className={st.bbrPanTilt} data-testid="pan-tilt">
            <h4 className={st.topLabel}>Pan ({panAngle.toFixed(1)}&deg;)</h4>
            <h4 className={st.leftLabel}>Tilt ({tiltAngle.toFixed(1)}&deg;)</h4>
            <div className={st.innerContainer}>
                <div
                    className={st.touchGrid}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                >
                    <div
                        className={st.angleXY}
                        style={{ top: `${angleY}px`, left: `${angleX}px` }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Converts pan/tilt servo servoAngles to XY coordinates in a square control grid.
 *
 * Maps servo servoAngles to pixel coordinates for displaying position indicators
 * in a pan/tilt control interface. Accounts for servo range constraints and
 * indicator size.
 *
 * @param panAngle - Current pan angle in degrees
 * @param panConfig - Pan servo configuration
 * @param tiltAngle - Current tilt angle in degrees
 * @param tiltConfig - Tilt servo configuration
 * @param containerSize - Size of the square container in pixels
 * @param indicatorRadius - Radius of the position indicator in pixels
 * @returns Tuple of [x, y] coordinates in pixels
 */
export function mapPanTiltToXYSquare(
    panAngle: number,
    panConfig: IServoConfig,
    tiltAngle: number,
    tiltConfig: IServoConfig,
    containerSize: number,
    indicatorRadius: number,
): [number, number] {
    const xf =
        panAngle -
        panConfig.min_angle / panConfig.max_angle -
        panConfig.min_angle;
    const x =
        containerSize -
        (xf * containerSize) / (panConfig.max_angle - panConfig.min_angle);

    const yf =
        tiltAngle -
        tiltConfig.min_angle / tiltConfig.max_angle -
        tiltConfig.min_angle;
    const y =
        (yf * containerSize) / (tiltConfig.max_angle - tiltConfig.min_angle);

    return [Math.max(x - indicatorRadius, 0), Math.max(y - indicatorRadius, 0)];
}

/**
 * Converts XY coordinates in a square control grid to pan/tilt servo servoAngles.
 *
 * Maps click/touch coordinates from a pan/tilt control interface to the
 * corresponding servo servoAngles. Inverse operation of mapPanTiltToXYSquare.
 *
 * @param x - X coordinate in pixels
 * @param y - Y coordinate in pixels
 * @param panConfig - Pan servo configuration
 * @param tiltConfig - Tilt servo configuration
 * @param containerSize - Size of the square container in pixels
 * @returns Tuple of [panAngle, tiltAngle] in degrees
 *
 * @example
 * ```typescript
 * const [panAngle, tiltAngle] = mapXYToPanTilt(
 *   100, 50,
 *   panConfig, tiltConfig,
 *   200
 * );
 * sendHubStateUpdate({ servo_angles: { pan: panAngle, tilt: tiltAngle } });
 * ```
 */
export function mapXYToPanTilt(
    x: number,
    y: number,
    panConfig: IServoConfig,
    tiltConfig: IServoConfig,
    containerSize: number,
): [number, number] {
    const panAngle =
        panConfig.max_angle -
        (x * (panConfig.max_angle - panConfig.min_angle)) / containerSize;
    const tiltAngle =
        (y * (tiltConfig.max_angle - tiltConfig.min_angle)) / containerSize +
        tiltConfig.min_angle;

    return [panAngle, tiltAngle];
}

export function isTouchEvent(
    e: React.TouchEvent | React.MouseEvent,
): e is React.TouchEvent {
    return e.nativeEvent instanceof TouchEvent;
}
