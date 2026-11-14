#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/NairobiTypes.h"
#include "NairobiVehicleConfiguration.generated.h"

class UCurveFloat;
class USoundBase;
class UNiagaraSystem;

/**
 * Data-driven vehicle tuning.
 *
 * Everything that distinguishes the Rally GT, Nganya 111 and Savannah V8 lives here so
 * handling can be tuned without touching gameplay code. Values are applied to the Chaos
 * vehicle by UNairobiVehicleSetupLibrary; the legacy prototype presets
 * (Content/Data/Vehicles/DT_VehicleConfigs.csv) are the starting point, not final truth.
 */
UCLASS(BlueprintType)
class NAIROBIRACING_API UNairobiVehicleConfiguration : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity")
	FString VehicleId = TEXT("safari-rally-gt");

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity")
	FText Subtitle;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity")
	FString Plate = TEXT("KDR 254N");

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity")
	ENairobiVehicleClass VehicleClass = ENairobiVehicleClass::RallyGT;

	// ---------------------------------------------------------------- Powertrain
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain")
	ENairobiDrivetrain Drivetrain = ENairobiDrivetrain::AWD;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "400", ClampMax = "4000"))
	float MassKg = 1380.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "100", ClampMax = "2500"))
	float MaxTorqueNm = 620.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "1000", ClampMax = "12000"))
	float MaxRPM = 7800.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "400", ClampMax = "2500"))
	float IdleRPM = 950.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain")
	TObjectPtr<UCurveFloat> TorqueCurve;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "2.0", ClampMax = "7.0"))
	float FinalDriveRatio = 3.7f;

	/** Forward gear ratios, 1st to top. Also defines the gear count for the HUD. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain")
	TArray<float> ForwardGearRatios = { 3.6f, 2.4f, 1.8f, 1.4f, 1.12f, 0.92f };

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "0.1", ClampMax = "3.0"))
	float GearChangeTimeSeconds = 0.35f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "1000", ClampMax = "10000"))
	float GearUpRPM = 6900.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Powertrain", meta = (ClampMin = "1000", ClampMax = "9000"))
	float GearDownRPM = 2400.f;

	// ---------------------------------------------------------------- Handling
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "5.0", ClampMax = "45.0"))
	float MaxSteerAngleDegrees = 32.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "0.2", ClampMax = "4.0"))
	float SteeringResponseSeconds = 0.55f;

	/** Fraction of steering authority removed at top speed (stability). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "0.0", ClampMax = "0.8"))
	float HighSpeedSteerReduction = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "100.0", ClampMax = "5000.0"))
	float DownforceCoefficient = 900.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "0.0", ClampMax = "5.0"))
	float DragCoefficient = 0.62f;

	/** Lateral grip scale applied to all tyres (1.0 = configured tyre friction). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling", meta = (ClampMin = "0.4", ClampMax = "2.0"))
	float TireGripScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Handling")
	bool bAllowDrifting = true;

	// ---------------------------------------------------------------- Nitrous
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Nitrous", meta = (ClampMin = "0.0", ClampMax = "3.0"))
	float NitroThrustMultiplier = 1.6f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Nitrous", meta = (ClampMin = "0.0", ClampMax = "400000.0"))
	float NitroForceNewtons = 8200.f;

	// ---------------------------------------------------------------- Presentation
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation")
	TSoftObjectPtr<USoundBase> EngineLoopSound;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation")
	TSoftObjectPtr<USoundBase> EngineOnLoadSound;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation")
	TSoftObjectPtr<USoundBase> HornSound;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation")
	TSoftObjectPtr<UNiagaraSystem> ExhaustVFX;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation")
	TSoftObjectPtr<UNiagaraSystem> TireSmokeVFX;

	/** Top speed used by server-side lap plausibility validation. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation", meta = (ClampMin = "80", ClampMax = "400"))
	float TopSpeedKphEstimate = 230.f;
};
