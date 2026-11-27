import type { Action, AnalogRole, Mode } from '../../types.ts';

/**
 * Readable names and categories for Elite Dangerous actions. Anything else falls back to
 * a prettified id, classified by its name: `Humanoid…` or `…_Humanoid` is on foot,
 * `…Buggy…` is the SRV, everything else is the ship.
 *
 * Every action id in a 4.1 preset exported by the game is listed here, in the order the
 * game writes them. That file (checked by hand, not committed) verified the ids and
 * which mode each sits in (the game groups them by mode); the readable names, and which
 * way an Increase/Decrease pair turns, are ours. UNVERIFIED: ids from older or newer
 * game versions.
 */

/** `[id, name, effect?, axis?]`. Effects are the mock flight's, from the StandFly board. */
type Entry = [id: string, name: string, effect?: string, axis?: true];

const CATALOGUE: Record<Mode, Record<string, Entry[]>> = {
	ship: {
		Flight: [
			['ForwardKey', 'Throttle up', 'thrUp'],
			['BackwardKey', 'Throttle down', 'thrDn'],
			['SetSpeedZero', 'Throttle to zero', 'thrZero'],
			['YawLeftButton', 'Yaw left', 'yawL'],
			['YawRightButton', 'Yaw right', 'yawR'],
			['RollLeftButton', 'Roll left', 'rollL'],
			['RollRightButton', 'Roll right', 'rollR'],
			['UpThrustButton', 'Thrust up', 'up'],
			['DownThrustButton', 'Thrust down', 'down'],
			['UseBoostJuice', 'Boost', 'boost'],
			['LandingGearToggle', 'Landing gear', 'gear'],
			['ToggleFlightAssist', 'Flight assist off', 'fa'],
			['ThrottleAxis', 'Throttle', 'throttle', true],
			['YawAxisRaw', 'Yaw', 'yawL|yawR', true],
			['RollAxisRaw', 'Roll', 'rollL|rollR', true],
			['PitchAxisRaw', 'Pitch', undefined, true],
			['VerticalThrustRaw', 'Vertical thrust', 'down|up', true],
			['LateralThrustRaw', 'Lateral thrust', undefined, true],
			['PitchUpButton', 'Pitch up'],
			['PitchDownButton', 'Pitch down'],
			['LeftThrustButton', 'Thrust left'],
			['RightThrustButton', 'Thrust right'],
			['AheadThrust', 'Forward thrust', undefined, true],
			['ForwardThrustButton', 'Thrust forward'],
			['BackwardThrustButton', 'Thrust back'],
			['YawToRollButton', 'Yaw into roll'],
			['DisableRotationCorrectToggle', 'Rotational correction'],
			['SetSpeedMinus100', 'Throttle to −100%'],
			['SetSpeedMinus75', 'Throttle to −75%'],
			['SetSpeedMinus50', 'Throttle to −50%'],
			['SetSpeedMinus25', 'Throttle to −25%'],
			['SetSpeed25', 'Throttle to 25%'],
			['SetSpeed50', 'Throttle to 50%'],
			['SetSpeed75', 'Throttle to 75%'],
			['SetSpeed100', 'Throttle to 100%'],
			['ToggleReverseThrottleInput', 'Reverse throttle'],
			['UseAlternateFlightValuesToggle', 'Alternate flight controls'],
			['YawAxisAlternate', 'Yaw (alternate)', undefined, true],
			['RollAxisAlternate', 'Roll (alternate)', undefined, true],
			['PitchAxisAlternate', 'Pitch (alternate)', undefined, true],
			['LateralThrustAlternate', 'Lateral thrust (alternate)', undefined, true],
			['VerticalThrustAlternate', 'Vertical thrust (alternate)', undefined, true],
			['MouseReset', 'Reset mouse'],
			['BlockMouseDecay', 'Hold mouse position']
		],
		Landing: [
			['YawAxis_Landing', 'Yaw (landing)', undefined, true],
			['YawLeftButton_Landing', 'Yaw left (landing)'],
			['YawRightButton_Landing', 'Yaw right (landing)'],
			['PitchAxis_Landing', 'Pitch (landing)', undefined, true],
			['PitchUpButton_Landing', 'Pitch up (landing)'],
			['PitchDownButton_Landing', 'Pitch down (landing)'],
			['RollAxis_Landing', 'Roll (landing)', undefined, true],
			['RollLeftButton_Landing', 'Roll left (landing)'],
			['RollRightButton_Landing', 'Roll right (landing)'],
			['LateralThrust_Landing', 'Lateral thrust (landing)', undefined, true],
			['LeftThrustButton_Landing', 'Thrust left (landing)'],
			['RightThrustButton_Landing', 'Thrust right (landing)'],
			['VerticalThrust_Landing', 'Vertical thrust (landing)', undefined, true],
			['UpThrustButton_Landing', 'Thrust up (landing)'],
			['DownThrustButton_Landing', 'Thrust down (landing)'],
			['AheadThrust_Landing', 'Forward thrust (landing)', undefined, true],
			['ForwardThrustButton_Landing', 'Thrust forward (landing)'],
			['BackwardThrustButton_Landing', 'Thrust back (landing)']
		],
		Navigation: [
			['HyperSuperCombination', 'Frame shift drive', 'fsd'],
			['Supercruise', 'Supercruise', 'sc'],
			['GalaxyMapOpen', 'Galaxy map', 'galmap'],
			['TargetNextRouteSystem', 'Target next system in route', 'route'],
			['OrbitLinesToggle', 'Orbit lines', 'orbit'],
			['Hyperspace', 'Hyperspace jump'],
			['SystemMapOpen', 'System map', 'sysmap']
		],
		Combat: [
			['PrimaryFire', 'Primary fire', 'fire'],
			['SecondaryFire', 'Secondary fire', 'fire2'],
			['DeployHardpointToggle', 'Deploy hardpoints', 'hp'],
			['SelectTarget', 'Target ahead', 'tgt'],
			['CycleNextHostileTarget', 'Next hostile', 'tgt'],
			['FireChaffLauncher', 'Deploy chaff', 'chaff'],
			['CycleNextTarget', 'Next target', 'tgt'],
			['CyclePreviousTarget', 'Previous target', 'tgt'],
			['SelectHighestThreat', 'Highest threat', 'tgt'],
			['CyclePreviousHostileTarget', 'Previous hostile', 'tgt'],
			['CycleNextSubsystem', 'Next subsystem'],
			['CyclePreviousSubsystem', 'Previous subsystem'],
			['CycleFireGroupNext', 'Next fire group'],
			['CycleFireGroupPrevious', 'Previous fire group'],
			['ChargeECM', 'Charge ECM'],
			['TriggerFieldNeutraliser', 'Shutdown field neutraliser'],
			['WeaponColourToggle', 'Weapon colour']
		],
		Wing: [
			['TargetWingman0', 'Target wingman 1', 'tgt'],
			['TargetWingman1', 'Target wingman 2', 'tgt'],
			['TargetWingman2', 'Target wingman 3', 'tgt'],
			['SelectTargetsTarget', 'Wingman’s target', 'tgt'],
			['WingNavLock', 'Wing nav lock']
		],
		Systems: [
			['DeployHeatSink', 'Deploy heat sink', 'heatsink'],
			['ToggleButtonUpInput', 'Silent running', 'silent'],
			['ToggleCargoScoop', 'Cargo scoop', 'scoop'],
			['ShipSpotLightToggle', 'Ship lights', 'lights'],
			['NightVisionToggle', 'Night vision', 'nv'],
			['IncreaseSystemsPower', 'Power to systems', 'pSys'],
			['IncreaseEnginesPower', 'Power to engines', 'pEng'],
			['IncreaseWeaponsPower', 'Power to weapons', 'pWep'],
			['ResetPowerDistribution', 'Balance power', 'pBal'],
			['UseShieldCell', 'Shield cell'],
			['RadarRangeAxis', 'Sensor range', undefined, true],
			['RadarIncreaseRange', 'Sensor range up'],
			['RadarDecreaseRange', 'Sensor range down'],
			['EjectAllCargo', 'Jettison all cargo'],
			['EngineColourToggle', 'Engine colour'],
			['PlayerHUDModeToggle', 'HUD mode'],
			['MicrophoneMute', 'Mute microphone'],
			['HMDReset', 'Reset VR headset']
		],
		Panels: [
			['FocusLeftPanel', 'Left panel', 'panel'],
			['FocusCommsPanel', 'Comms panel', 'panel'],
			['FocusRadarPanel', 'Role panel', 'panel'],
			['FocusRightPanel', 'Right panel', 'panel'],
			['QuickCommsPanel', 'Quick comms', 'panel'],
			['UIFocus', 'UI focus'],
			['ShowPGScoreSummaryInput', 'Score summary', 'panel'],
			['OpenCodexGoToDiscovery', 'Codex discovery', 'panel'],
			['FriendsMenu', 'Friends', 'panel'],
			['Pause', 'Pause menu', 'panel'],
			['GalnetAudio_Play_Pause', 'Galnet audio play / pause'],
			['GalnetAudio_SkipForward', 'Galnet audio skip forward'],
			['GalnetAudio_SkipBackward', 'Galnet audio skip back'],
			['GalnetAudio_ClearQueue', 'Galnet audio clear queue']
		],
		'Head look': [
			['HeadLookReset', 'Reset head look', 'panel'],
			['HeadLookToggle', 'Head look'],
			['HeadLookPitchAxisRaw', 'Head look up / down', undefined, true],
			['HeadLookPitchUp', 'Head look up'],
			['HeadLookPitchDown', 'Head look down'],
			['HeadLookYawAxis', 'Head look left / right', undefined, true],
			['HeadLookYawLeft', 'Head look left'],
			['HeadLookYawRight', 'Head look right']
		],
		Menus: [
			['UI_Up', 'Menu up'],
			['UI_Down', 'Menu down'],
			['UI_Left', 'Menu left'],
			['UI_Right', 'Menu right'],
			['UI_Select', 'Menu select'],
			['UI_Back', 'Menu back'],
			['UI_Toggle', 'Menu toggle'],
			['CycleNextPanel', 'Next panel tab'],
			['CyclePreviousPanel', 'Previous panel tab'],
			['CycleNextPage', 'Next page'],
			['CyclePreviousPage', 'Previous page']
		],
		'Galaxy map': [
			['CamPitchAxis', 'Map pitch', undefined, true],
			['CamPitchUp', 'Map pitch up'],
			['CamPitchDown', 'Map pitch down'],
			['CamYawAxis', 'Map yaw', undefined, true],
			['CamYawLeft', 'Map yaw left'],
			['CamYawRight', 'Map yaw right'],
			['CamTranslateYAxis', 'Map forward / back', undefined, true],
			['CamTranslateForward', 'Map forward'],
			['CamTranslateBackward', 'Map back'],
			['CamTranslateXAxis', 'Map left / right', undefined, true],
			['CamTranslateLeft', 'Map left'],
			['CamTranslateRight', 'Map right'],
			['CamTranslateZAxis', 'Map up / down', undefined, true],
			['CamTranslateUp', 'Map up'],
			['CamTranslateDown', 'Map down'],
			['CamZoomAxis', 'Map zoom', undefined, true],
			['CamZoomIn', 'Map zoom in'],
			['CamZoomOut', 'Map zoom out'],
			['CamTranslateZHold', 'Map up / down hold'],
			['GalaxyMapHome', 'Map home']
		],
		Scanners: [
			['ExplorationFSSEnter', 'Full spectrum scanner'],
			['ExplorationFSSDiscoveryScan', 'Discovery scan'],
			['ExplorationFSSQuit', 'Leave FSS'],
			['ExplorationFSSTarget', 'FSS target'],
			['ExplorationFSSCameraPitch', 'FSS pitch', undefined, true],
			['ExplorationFSSCameraPitchIncreaseButton', 'FSS pitch up'],
			['ExplorationFSSCameraPitchDecreaseButton', 'FSS pitch down'],
			['ExplorationFSSCameraYaw', 'FSS yaw', undefined, true],
			['ExplorationFSSCameraYawIncreaseButton', 'FSS yaw right'],
			['ExplorationFSSCameraYawDecreaseButton', 'FSS yaw left'],
			['ExplorationFSSZoomIn', 'FSS zoom in'],
			['ExplorationFSSZoomOut', 'FSS zoom out'],
			['ExplorationFSSMiniZoomIn', 'FSS fine zoom in'],
			['ExplorationFSSMiniZoomOut', 'FSS fine zoom out'],
			['ExplorationFSSRadioTuningX_Raw', 'FSS tuning', undefined, true],
			['ExplorationFSSRadioTuningX_Increase', 'FSS tune up'],
			['ExplorationFSSRadioTuningX_Decrease', 'FSS tune down'],
			['ExplorationFSSRadioTuningAbsoluteX', 'FSS tuning (absolute)', undefined, true],
			['ExplorationFSSShowHelp', 'FSS help'],
			['ExplorationSAAChangeScannedAreaViewToggle', 'DSS view'],
			['ExplorationSAAExitThirdPerson', 'Leave DSS'],
			['ExplorationSAANextGenus', 'Next genus'],
			['ExplorationSAAPreviousGenus', 'Previous genus'],
			['SAAThirdPersonYawAxisRaw', 'DSS yaw', undefined, true],
			['SAAThirdPersonYawLeftButton', 'DSS yaw left'],
			['SAAThirdPersonYawRightButton', 'DSS yaw right'],
			['SAAThirdPersonPitchAxisRaw', 'DSS pitch', undefined, true],
			['SAAThirdPersonPitchUpButton', 'DSS pitch up'],
			['SAAThirdPersonPitchDownButton', 'DSS pitch down'],
			['SAAThirdPersonFovAxisRaw', 'DSS zoom', undefined, true],
			['SAAThirdPersonFovOutButton', 'DSS zoom out'],
			['SAAThirdPersonFovInButton', 'DSS zoom in']
		],
		Multicrew: [
			['MultiCrewToggleMode', 'Multicrew mode'],
			['MultiCrewPrimaryFire', 'Gunner primary fire'],
			['MultiCrewSecondaryFire', 'Gunner secondary fire'],
			['MultiCrewPrimaryUtilityFire', 'Gunner primary utility'],
			['MultiCrewSecondaryUtilityFire', 'Gunner secondary utility'],
			['MultiCrewThirdPersonYawAxisRaw', 'Multicrew yaw', undefined, true],
			['MultiCrewThirdPersonYawLeftButton', 'Multicrew yaw left'],
			['MultiCrewThirdPersonYawRightButton', 'Multicrew yaw right'],
			['MultiCrewThirdPersonPitchAxisRaw', 'Multicrew pitch', undefined, true],
			['MultiCrewThirdPersonPitchUpButton', 'Multicrew pitch up'],
			['MultiCrewThirdPersonPitchDownButton', 'Multicrew pitch down'],
			['MultiCrewThirdPersonFovAxisRaw', 'Multicrew zoom', undefined, true],
			['MultiCrewThirdPersonFovOutButton', 'Multicrew zoom out'],
			['MultiCrewThirdPersonFovInButton', 'Multicrew zoom in'],
			['MultiCrewCockpitUICycleForward', 'Multicrew next panel'],
			['MultiCrewCockpitUICycleBackward', 'Multicrew previous panel']
		],
		'Fighter orders': [
			['OpenOrders', 'Fighter orders', 'panel'],
			['OrderRequestDock', 'Fighter: dock'],
			['OrderDefensiveBehaviour', 'Fighter: defend'],
			['OrderAggressiveBehaviour', 'Fighter: engage at will'],
			['OrderFocusTarget', 'Fighter: attack my target'],
			['OrderHoldFire', 'Fighter: hold fire'],
			['OrderHoldPosition', 'Fighter: hold position'],
			['OrderFollow', 'Fighter: follow']
		],
		Camera: [
			['PhotoCameraToggle', 'Camera suite'],
			['VanityCameraScrollLeft', 'Previous camera'],
			['VanityCameraScrollRight', 'Next camera'],
			['ToggleFreeCam', 'Free camera'],
			['VanityCameraOne', 'Camera 1'],
			['VanityCameraTwo', 'Camera 2'],
			['VanityCameraThree', 'Camera 3'],
			['VanityCameraFour', 'Camera 4'],
			['VanityCameraFive', 'Camera 5'],
			['VanityCameraSix', 'Camera 6'],
			['VanityCameraSeven', 'Camera 7'],
			['VanityCameraEight', 'Camera 8'],
			['VanityCameraNine', 'Camera 9'],
			['VanityCameraTen', 'Camera 10'],
			['FreeCamToggleHUD', 'Camera HUD'],
			['FreeCamSpeedInc', 'Camera faster'],
			['FreeCamSpeedDec', 'Camera slower'],
			['MoveFreeCamY', 'Camera forward / back', undefined, true],
			['ToggleReverseThrottleInputFreeCam', 'Camera reverse throttle'],
			['MoveFreeCamForward', 'Camera forward'],
			['MoveFreeCamBackwards', 'Camera back'],
			['MoveFreeCamX', 'Camera left / right', undefined, true],
			['MoveFreeCamRight', 'Camera right'],
			['MoveFreeCamLeft', 'Camera left'],
			['MoveFreeCamZ', 'Camera up / down', undefined, true],
			['MoveFreeCamUpAxis', 'Camera up (axis)', undefined, true],
			['MoveFreeCamDownAxis', 'Camera down (axis)', undefined, true],
			['MoveFreeCamUp', 'Camera up'],
			['MoveFreeCamDown', 'Camera down'],
			['PitchCamera', 'Camera pitch', undefined, true],
			['PitchCameraUp', 'Camera pitch up'],
			['PitchCameraDown', 'Camera pitch down'],
			['YawCamera', 'Camera yaw', undefined, true],
			['YawCameraLeft', 'Camera yaw left'],
			['YawCameraRight', 'Camera yaw right'],
			['RollCamera', 'Camera roll', undefined, true],
			['RollCameraLeft', 'Camera roll left'],
			['RollCameraRight', 'Camera roll right'],
			['ToggleRotationLock', 'Camera rotation lock'],
			['FixCameraRelativeToggle', 'Fix camera to ship'],
			['FixCameraWorldToggle', 'Fix camera in space'],
			['QuitCamera', 'Leave camera'],
			['ToggleAdvanceMode', 'Camera advanced mode'],
			['FreeCamZoomIn', 'Camera zoom in'],
			['FreeCamZoomOut', 'Camera zoom out'],
			['FStopDec', 'Aperture down'],
			['FStopInc', 'Aperture up']
		],
		'Store and Holo-Me': [
			['StoreToggle', 'Store', 'panel'],
			['StoreEnableRotation', 'Store rotate'],
			['StorePitchCamera', 'Store pitch', undefined, true],
			['StoreYawCamera', 'Store yaw', undefined, true],
			['StoreCamZoomIn', 'Store zoom in'],
			['StoreCamZoomOut', 'Store zoom out'],
			['CommanderCreator_Undo', 'Holo-Me undo'],
			['CommanderCreator_Redo', 'Holo-Me redo'],
			['CommanderCreator_Rotation_MouseToggle', 'Holo-Me rotate with mouse'],
			['CommanderCreator_Rotation', 'Holo-Me rotate', undefined, true]
		]
	},
	srv: {
		Driving: [
			['IncreaseSpeedButtonMax', 'Accelerate', 'drvFwd'],
			['DecreaseSpeedButtonMax', 'Reverse', 'drvRev'],
			['SteerLeftButton', 'Steer left', 'steerL'],
			['SteerRightButton', 'Steer right', 'steerR'],
			['AutoBreakBuggyButton', 'Handbrake', 'brake'],
			['VerticalThrustersButton', 'Vertical thrusters', 'jets'],
			['ToggleDriveAssist', 'Drive assist', 'da'],
			['SteeringAxis', 'Steering', 'steerL|steerR', true],
			['DriveSpeedAxis', 'Drive speed', undefined, true],
			['IncreaseSpeedButtonPartial', 'Speed up', undefined, true],
			['DecreaseSpeedButtonPartial', 'Slow down', undefined, true],
			['BuggyToggleReverseThrottleInput', 'Reverse throttle'],
			['BuggyRollAxisRaw', 'Roll', undefined, true],
			['BuggyRollLeftButton', 'Roll left'],
			['BuggyRollRightButton', 'Roll right'],
			['BuggyPitchAxis', 'Pitch', undefined, true],
			['BuggyPitchUpButton', 'Pitch up'],
			['BuggyPitchDownButton', 'Pitch down']
		],
		Turret: [
			['ToggleBuggyTurretButton', 'Turret mode', 'turret'],
			['BuggyPrimaryFireButton', 'Primary fire', 'tFire'],
			['BuggySecondaryFireButton', 'Secondary fire', 'tFire2'],
			['SelectTarget_Buggy', 'Target ahead', 'tgt'],
			['BuggyCycleFireGroupNext', 'Next fire group'],
			['BuggyCycleFireGroupPrevious', 'Previous fire group'],
			['BuggyTurretYawAxisRaw', 'Turret yaw', undefined, true],
			['BuggyTurretYawLeftButton', 'Turret left'],
			['BuggyTurretYawRightButton', 'Turret right'],
			['BuggyTurretPitchAxisRaw', 'Turret pitch', undefined, true],
			['BuggyTurretPitchUpButton', 'Turret up'],
			['BuggyTurretPitchDownButton', 'Turret down']
		],
		Systems: [
			['HeadlightsBuggyButton', 'Headlights', 'sLights'],
			['ToggleCargoScoop_Buggy', 'Cargo scoop', 'sScoop'],
			['RecallDismissShip', 'Recall / dismiss ship', 'recall'],
			['IncreaseSystemsPower_Buggy', 'Power to systems', 'pSys'],
			['IncreaseEnginesPower_Buggy', 'Power to engines', 'pEng'],
			['IncreaseWeaponsPower_Buggy', 'Power to weapons', 'pWep'],
			['ResetPowerDistribution_Buggy', 'Balance power', 'pBal'],
			['EjectAllCargo_Buggy', 'Jettison all cargo'],
			['PlayerHUDModeToggle_Buggy', 'HUD mode'],
			['HeadLookToggle_Buggy', 'Head look'],
			['PhotoCameraToggle_Buggy', 'Camera suite']
		],
		Panels: [
			['FocusLeftPanel_Buggy', 'Left panel', 'panel'],
			['FocusCommsPanel_Buggy', 'Comms panel', 'panel'],
			['FocusRadarPanel_Buggy', 'Role panel', 'panel'],
			['FocusRightPanel_Buggy', 'Right panel', 'panel'],
			['GalaxyMapOpen_Buggy', 'Galaxy map', 'galmap'],
			['SystemMapOpen_Buggy', 'System map', 'sysmap'],
			['QuickCommsPanel_Buggy', 'Quick comms', 'panel'],
			['OpenCodexGoToDiscovery_Buggy', 'Codex discovery', 'panel'],
			['UIFocus_Buggy', 'UI focus']
		]
	},
	foot: {
		Moving: [
			['HumanoidForwardButton', 'Move forward', 'walkF'],
			['HumanoidBackwardButton', 'Move back', 'walkB'],
			['HumanoidStrafeLeftButton', 'Strafe left', 'walkL'],
			['HumanoidStrafeRightButton', 'Strafe right', 'walkR'],
			['HumanoidSprintButton', 'Sprint', 'sprint'],
			['HumanoidJumpButton', 'Jump', 'jump'],
			['HumanoidCrouchButton', 'Crouch', 'crouch'],
			['HumanoidWalkButton', 'Walk'],
			['HumanoidForwardAxis', 'Move forward / back', undefined, true],
			['HumanoidStrafeAxis', 'Strafe', undefined, true],
			['HumanoidRotateAxis', 'Look left / right', undefined, true],
			['HumanoidPitchAxis', 'Look up / down', undefined, true],
			['HumanoidRotateLeftButton', 'Look left'],
			['HumanoidRotateRightButton', 'Look right'],
			['HumanoidPitchUpButton', 'Look up'],
			['HumanoidPitchDownButton', 'Look down']
		],
		Combat: [
			['HumanoidPrimaryFireButton', 'Fire weapon', 'primary'],
			['HumanoidZoomButton', 'Aim down sights', 'aim'],
			['HumanoidReloadButton', 'Reload', 'reload'],
			['HumanoidMeleeButton', 'Melee', 'melee'],
			['HumanoidThrowGrenadeButton', 'Throw grenade', 'grenade'],
			['HumanoidSelectNextWeaponButton', 'Next weapon', 'wNext'],
			['HumanoidSelectPreviousWeaponButton', 'Previous weapon', 'wPrev'],
			['HumanoidHideWeaponButton', 'Holster weapon', 'holster'],
			['HumanoidSwitchWeapon', 'Switch weapon'],
			['HumanoidSelectPrimaryWeaponButton', 'Primary weapon'],
			['HumanoidSelectSecondaryWeaponButton', 'Secondary weapon'],
			['HumanoidSelectUtilityWeaponButton', 'Utility weapon'],
			['HumanoidSelectNextGrenadeTypeButton', 'Next grenade'],
			['HumanoidSelectPreviousGrenadeTypeButton', 'Previous grenade'],
			['HumanoidSelectFragGrenade', 'Frag grenade'],
			['HumanoidSelectEMPGrenade', 'EMP grenade'],
			['HumanoidSelectShieldGrenade', 'Shield projector']
		],
		Tools: [
			['HumanoidPrimaryInteractButton', 'Interact', 'interact'],
			['HumanoidHealthPack', 'Use medkit', 'medkit'],
			['HumanoidBattery', 'Use energy cell', 'cell'],
			['HumanoidToggleFlashlightButton', 'Flashlight', 'flash'],
			['HumanoidToggleNightVisionButton', 'Night vision', 'fNv'],
			['HumanoidSwitchToCompAnalyser', 'Profile analyser', 'scan'],
			['HumanoidPing', 'Ping', 'ping'],
			['HumanoidSecondaryInteractButton', 'Secondary interact'],
			['HumanoidToggleShieldsButton', 'Toggle suit shield'],
			['HumanoidSwitchToRechargeTool', 'Energylink'],
			['HumanoidSwitchToSuitTool', 'Suit tool'],
			['HumanoidToggleToolModeButton', 'Tool mode'],
			['HumanoidClearAuthorityLevel', 'Clear authority level'],
			['PhotoCameraToggle_Humanoid', 'Camera suite']
		],
		Panels: [
			['HumanoidEmoteWheelButton', 'Emote wheel', 'panel'],
			['HumanoidItemWheelButton', 'Item wheel', 'panel'],
			['GalaxyMapOpen_Humanoid', 'Galaxy map', 'galmap'],
			['SystemMapOpen_Humanoid', 'System map', 'sysmap'],
			['FocusCommsPanel_Humanoid', 'Comms panel', 'panel'],
			['QuickCommsPanel_Humanoid', 'Quick comms', 'panel'],
			['HumanoidOpenAccessPanelButton', 'Access panel', 'panel'],
			['HumanoidToggleMissionHelpPanelButton', 'Mission help', 'panel'],
			['HumanoidConflictContextualUIButton', 'Conflict zone panel', 'panel'],
			['HumanoidUtilityWheelCycleMode', 'Cycle wheel mode'],
			['HumanoidItemWheelButton_XAxis', 'Wheel left / right', undefined, true],
			['HumanoidItemWheelButton_XLeft', 'Wheel left'],
			['HumanoidItemWheelButton_XRight', 'Wheel right'],
			['HumanoidItemWheelButton_YAxis', 'Wheel up / down', undefined, true],
			['HumanoidItemWheelButton_YUp', 'Wheel up'],
			['HumanoidItemWheelButton_YDown', 'Wheel down']
		],
		Emotes: [
			['HumanoidEmoteSlot1', 'Emote 1'],
			['HumanoidEmoteSlot2', 'Emote 2'],
			['HumanoidEmoteSlot3', 'Emote 3'],
			['HumanoidEmoteSlot4', 'Emote 4'],
			['HumanoidEmoteSlot5', 'Emote 5'],
			['HumanoidEmoteSlot6', 'Emote 6'],
			['HumanoidEmoteSlot7', 'Emote 7'],
			['HumanoidEmoteSlot8', 'Emote 8']
		]
	}
};

/** The axes the 3D scene flies and drives by. */
const ANALOG: Record<string, AnalogRole> = {
	ThrottleAxis: 'throttle',
	PitchAxisRaw: 'pitch',
	RollAxisRaw: 'roll',
	YawAxisRaw: 'yaw',
	SteeringAxis: 'steer',
	DriveSpeedAxis: 'drive',
	HumanoidForwardAxis: 'moveY',
	HumanoidStrafeAxis: 'moveX',
	HumanoidRotateAxis: 'lookX',
	HumanoidPitchAxis: 'lookY'
};

interface Known {
	name: string;
	category: string;
	mode: Mode;
	axis: boolean;
	effect?: string;
	order: number;
}

/** Catalogued actions by id. Exported for the specs that check nothing goes unbound. */
export const KNOWN = new Map<string, Known>();
let order = 0;
for (const [mode, categories] of Object.entries(CATALOGUE) as [Mode, Record<string, Entry[]>][]) {
	for (const [category, entries] of Object.entries(categories)) {
		for (const [id, name, effect, axis] of entries) {
			KNOWN.set(id, { name, category, mode, axis: Boolean(axis), effect, order: order++ });
		}
	}
}

/** SRV actions whose ids don't say "Buggy". */
const SRV_IDS = new Set(
	Object.values(CATALOGUE.srv)
		.flat()
		.map(([id]) => id)
);

export function classifyMode(id: string): Mode {
	if (KNOWN.has(id)) return KNOWN.get(id)!.mode;
	if (id.startsWith('Humanoid') || id.endsWith('_Humanoid')) return 'foot';
	if (/Buggy/.test(id) || SRV_IDS.has(id)) return 'srv';
	return 'ship';
}

/** `HumanoidToggleShieldsButton` → "Toggle shields"; `IncreaseEnginesPower_Buggy` → "Increase engines power". */
export function prettify(id: string): string {
	const words = id
		.replace(/^Humanoid|_Humanoid$/g, '')
		.replace(/_Buggy$|Buggy/g, '')
		.replace(/_/g, ' ')
		.replace(/(Button|Key)$/, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.trim()
		.toLowerCase();
	return words ? words[0].toUpperCase() + words.slice(1) : id;
}

/**
 * Screens and modes Elite reads apart from normal flight (or walking), so one key can
 * do a job in each without a clash: W pitches the ship and moves the galaxy map. The
 * ways in (`ExplorationFSSEnter`, `PhotoCameraToggle`, `HeadLookToggle`) stay in flight.
 * UNVERIFIED: which screens the game reads separately is from memory, not the file.
 */
const CONTEXTS: [RegExp, string][] = [
	[/^UI_|^Cycle(Next|Previous)(Panel|Page)$/, 'menus'],
	[/^Cam(Pitch|Yaw|Translate|Zoom)|^GalaxyMapHome$/, 'galaxy map'],
	// The ship's fixed cameras, then the free camera they hand over to (ToggleFreeCam).
	[/^(VanityCamera|ToggleFreeCam$|QuitCamera$)/, 'camera'],
	[
		/^(FreeCam|MoveFreeCam|(Pitch|Yaw|Roll)Camera|ToggleRotationLock|FixCamera|ToggleAdvanceMode|FStop|ToggleReverseThrottleInputFreeCam)/,
		'free camera'
	],
	[/^ExplorationFSS(?!Enter$)/, 'fss'],
	[/^(ExplorationSAA|SAAThirdPerson)/, 'dss'],
	[/^HeadLook(Pitch|Yaw)/, 'head look'],
	[/^MultiCrew/, 'multicrew'],
	[/_Landing$/, 'landing'],
	[/^\w+Alternate$/, 'alternate flight'],
	[/^Store/, 'store'],
	[/^CommanderCreator/, 'holo-me'],
	[/^GalnetAudio/, 'galnet'],
	[/^HumanoidItemWheelButton_|^HumanoidUtilityWheelCycleMode$/, 'wheel']
];

function contextOf(id: string): string | undefined {
	return CONTEXTS.find(([pattern]) => pattern.test(id))?.[1];
}

export function describeAction(id: string, axisInFile: boolean): Action {
	const context = contextOf(id);
	const known = KNOWN.get(id);
	if (known) {
		return {
			id,
			name: known.name,
			category: known.category,
			mode: known.mode,
			...((known.axis || axisInFile) && { axis: true }),
			...(known.effect && { effect: known.effect }),
			...(ANALOG[id] && { analog: ANALOG[id] }),
			...(context && { context })
		};
	}
	return {
		id,
		name: prettify(id),
		category: 'Other',
		mode: classifyMode(id),
		...(axisInFile && { axis: true }),
		...(context && { context })
	};
}

/** Known actions first in catalogue order, then the rest by name. */
export function compareActions(a: Action, b: Action): number {
	const ka = KNOWN.get(a.id)?.order ?? Infinity;
	const kb = KNOWN.get(b.id)?.order ?? Infinity;
	if (ka !== kb) return ka - kb;
	return a.name.localeCompare(b.name);
}
