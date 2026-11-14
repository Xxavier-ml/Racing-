#pragma once

#include "CoreMinimal.h"
#include "NairobiTypes.generated.h"

/** Playable modes. Circuit is the competitive mode; FreeDrive is the open city. */
UENUM(BlueprintType)
enum class ENairobiGameMode : uint8
{
	Circuit UMETA(DisplayName = "Circuit Race"),
	FreeDrive UMETA(DisplayName = "Free Drive")
};

/** Server-owned race lifecycle. Clients render from the replicated phase only. */
UENUM(BlueprintType)
enum class ENairobiRacePhase : uint8
{
	Lobby,
	Countdown,
	Racing,
	Finished
};

UENUM(BlueprintType)
enum class ENairobiWeatherType : uint8
{
	Clear,
	Cloudy,
	Rain,
	Night,
	Fog
};

UENUM(BlueprintType)
enum class ENairobiCameraMode : uint8
{
	Chase,
	Bumper,
	Hood,
	Aerial,
	Cockpit
};

UENUM(BlueprintType)
enum class ENairobiVehicleClass : uint8
{
	RallyGT,
	Nganya,
	SavannahV8,
	TrafficMatatu,
	TrafficBodaBoda,
	TrafficBus,
	TrafficSaloon,
	TrafficSafari
};

UENUM(BlueprintType)
enum class ENairobiDrivetrain : uint8
{
	FWD,
	RWD,
	AWD
};

UENUM(BlueprintType)
enum class ENairobiSurfaceType : uint8
{
	Tarmac,
	Concrete,
	Dirt,
	Grass,
	Curb,
	Puddle
};

UENUM(BlueprintType)
enum class ENairobiGraphicsPreset : uint8
{
	Low,
	Medium,
	High,
	Ultra
};

/** One validated race participant result. Only the server may author these. */
USTRUCT(BlueprintType)
struct FNairobiRaceResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	int32 FinishPosition = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	FString PlayerId;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	FString DisplayName;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	FString VehicleId;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	float TotalTimeSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	float BestLapSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	int32 LapsCompleted = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	bool bValidated = false;

	UPROPERTY(BlueprintReadOnly, Category = "Race")
	bool bDisconnected = false;
};

USTRUCT(BlueprintType)
struct FNairobiLapRecord
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	FString PlayerId;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	FString VehicleId;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	float LapTimeSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	float TopSpeedKph = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	float DriftScore = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	FString RecordedAtIso;
};

/** Recorded ghost-lap sample. Stored in cm to match world space. */
USTRUCT(BlueprintType)
struct FNairobiGhostSample
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ghost")
	float TimeSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Ghost")
	FVector2D PositionCm = FVector2D::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "Ghost")
	float YawRadians = 0.f;
};

/** Replicated weather snapshot. The server is the only writer during a race. */
USTRUCT(BlueprintType)
struct FNairobiWeatherState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	ENairobiWeatherType Condition = ENairobiWeatherType::Clear;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float Wetness01 = 0.f;

	/** Drives rainfall/tyre-spray VFX and wet-road material blending. */
	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float RainIntensity01 = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float FogDensity = 0.00135f;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float GripMultiplier = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float BrakeMultiplier = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float VisibilityMeters = 740.f;

	UPROPERTY(BlueprintReadOnly, Category = "Weather")
	float AirTemperatureCelsius = 22.f;
};

USTRUCT(BlueprintType)
struct FNairobiGraphicsSettings
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	ENairobiGraphicsPreset Preset = ENairobiGraphicsPreset::High;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bLumenEnabled = true;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bNaniteEnabled = true;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bHardwareRayTracing = false;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	int32 ShadowQuality = 3;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	int32 EffectsQuality = 3;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float ResolutionScalePercent = 100.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	int32 FrameRateLimit = 0;
};

USTRUCT(BlueprintType)
struct FNairobiAudioSettings
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float MasterVolume = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float EngineVolume = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float SfxVolume = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float TrafficVolume = 0.8f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float MusicVolume = 0.7f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bMuteInBackground = true;
};

USTRUCT(BlueprintType)
struct FNairobiControlSettings
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float SteeringSensitivity = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float ThrottleSensitivity = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	float BrakeSensitivity = 1.f;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bAutomaticGearbox = true;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bGamepadVibration = true;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	bool bInvertCameraY = false;
};

/** Driver input after sensitivity curves and assists, before reaching Chaos. */
USTRUCT(BlueprintType)
struct FNairobiDriverInput
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Input")
	float Steering = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Input")
	float Throttle = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Input")
	float Brake = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Input")
	bool bHandbrake = false;

	UPROPERTY(BlueprintReadOnly, Category = "Input")
	bool bBoost = false;
};
