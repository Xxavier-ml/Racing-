#include "VehiclePhysics/NairobiVehicleSetupLibrary.h"

#include "Vehicles/NairobiVehicleConfiguration.h"
#include "ChaosWheeledVehicleMovementComponent.h"
#include "ChaosVehicleWheel.h"
#include "NairobiRacing.h"

void UNairobiVehicleSetupLibrary::ApplyConfiguration(
	UChaosWheeledVehicleMovementComponent* Movement,
	const UNairobiVehicleConfiguration* Configuration,
	float SurfaceGripMultiplier)
{
	if (Movement == nullptr || Configuration == nullptr)
	{
		return;
	}

	// --- Engine -------------------------------------------------------------
	Movement->EngineSetup.MaxTorque = Configuration->MaxTorqueNm;
	Movement->EngineSetup.MaxRPM = Configuration->MaxRPM;
	Movement->EngineSetup.EngineIdleRPM = Configuration->IdleRPM;

	if (Configuration->TorqueCurve)
	{
		Movement->EngineSetup.TorqueCurve.ExternalCurve = Configuration->TorqueCurve;
	}

	// --- Transmission -------------------------------------------------------
	Movement->TransmissionSetup.FinalRatio = Configuration->FinalDriveRatio;
	Movement->TransmissionSetup.ForwardGearRatios = Configuration->ForwardGearRatios;
	Movement->TransmissionSetup.ChangeUpRPM = Configuration->GearUpRPM;
	Movement->TransmissionSetup.ChangeDownRPM = Configuration->GearDownRPM;
	Movement->TransmissionSetup.GearChangeTime = Configuration->GearChangeTimeSeconds;
	Movement->SetUseAutoGears(true);

	// --- Chassis ------------------------------------------------------------
	Movement->Mass = Configuration->MassKg;
	Movement->DragCoefficient = Configuration->DragCoefficient;
	Movement->DownforceCoefficient = Configuration->DownforceCoefficient;

	ApplySurfaceGrip(Movement, Configuration, SurfaceGripMultiplier);

	UE_LOG(LogNairobiVehicle, Log,
		TEXT("Applied vehicle config '%s': mass=%.0fkg torque=%.0fNm gears=%d gripScale=%.2f"),
		*Configuration->VehicleId,
		Configuration->MassKg,
		Configuration->MaxTorqueNm,
		Configuration->ForwardGearRatios.Num(),
		SurfaceGripMultiplier);
}

void UNairobiVehicleSetupLibrary::ApplySurfaceGrip(
	UChaosWheeledVehicleMovementComponent* Movement,
	const UNairobiVehicleConfiguration* Configuration,
	float SurfaceGripMultiplier)
{
	if (Movement == nullptr || Configuration == nullptr)
	{
		return;
	}

	// Weather and surface changes must affect braking/drifting, not just visuals.
	const float EffectiveScale = FMath::Clamp(Configuration->TireGripScale * SurfaceGripMultiplier, 0.2f, 2.5f);

	for (UChaosVehicleWheel* Wheel : Movement->Wheels)
	{
		if (Wheel)
		{
			Wheel->FrictionForceMultiplier = EffectiveScale;
		}
	}
}

float UNairobiVehicleSetupLibrary::GetNormalizedRPM(
	const UChaosWheeledVehicleMovementComponent* Movement,
	float IdleRPM,
	float MaxRPM)
{
	if (Movement == nullptr || MaxRPM <= IdleRPM)
	{
		return 0.f;
	}
	const float RPM = Movement->GetEngineRotationSpeed();
	return FMath::Clamp((RPM - IdleRPM) / (MaxRPM - IdleRPM), 0.f, 1.f);
}
