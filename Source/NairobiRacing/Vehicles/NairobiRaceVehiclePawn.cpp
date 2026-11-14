#include "Vehicles/NairobiRaceVehiclePawn.h"

#include "Audio/NairobiVehicleAudioComponent.h"
#include "Camera/NairobiCameraRigComponent.h"
#include "GameModes/NairobiRaceGameMode.h"
#include "GameModes/NairobiRaceGameState.h"
#include "GameModes/NairobiRacePlayerState.h"
#include "Race/NairobiRaceManager.h"
#include "VehiclePhysics/NairobiNitroComponent.h"
#include "VehiclePhysics/NairobiVehicleRecoveryComponent.h"
#include "VehiclePhysics/NairobiVehicleSetupLibrary.h"
#include "Vehicles/NairobiVehicleConfiguration.h"
#include "World/NairobiCheckpointGate.h"
#include "World/NairobiRaceTrackData.h"
#include "NairobiRacing.h"

#include "ChaosWheeledVehicleMovementComponent.h"
#include "Components/BoxComponent.h"
#include "Components/SkeletalMeshComponent.h"

ANairobiRaceVehiclePawn::ANairobiRaceVehiclePawn()
{
	PrimaryActorTick.bCanEverTick = true;

	bReplicates = true;
	SetReplicateMovement(true);

	bUseControllerRotationYaw = false;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;

	CameraRig = CreateDefaultSubobject<UNairobiCameraRigComponent>(TEXT("CameraRig"));
	NitroComponent = CreateDefaultSubobject<UNairobiNitroComponent>(TEXT("Nitro"));
	RecoveryComponent = CreateDefaultSubobject<UNairobiVehicleRecoveryComponent>(TEXT("Recovery"));
	VehicleAudioComponent = CreateDefaultSubobject<UNairobiVehicleAudioComponent>(TEXT("VehicleAudio"));

	CheckpointProbe = CreateDefaultSubobject<UBoxComponent>(TEXT("CheckpointProbe"));
	CheckpointProbe->SetBoxExtent(FVector(230.f, 110.f, 90.f));
	CheckpointProbe->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	CheckpointProbe->SetCollisionResponseToAllChannels(ECR_Ignore);
	CheckpointProbe->SetCollisionResponseToChannel(ECC_WorldDynamic, ECR_Overlap);
	CheckpointProbe->SetCollisionResponseToChannel(ECC_Vehicle, ECR_Overlap);
	CheckpointProbe->SetGenerateOverlapEvents(true);

	if (USkeletalMeshComponent* Chassis = GetMesh())
	{
		CameraRig->AttachToComponent(Chassis, FAttachmentTransformRules::KeepRelativeTransform, TEXT("Chassis"));
		CheckpointProbe->AttachToComponent(Chassis, FAttachmentTransformRules::KeepRelativeTransform, TEXT("Chassis"));
	}
}

void ANairobiRaceVehiclePawn::BeginPlay()
{
	Super::BeginPlay();

	SetReplicateMovement(true);
	CheckpointProbe->OnComponentBeginOverlap.AddDynamic(this, &ANairobiRaceVehiclePawn::HandleCheckpointOverlap);

	if (VehicleConfiguration)
	{
		UNairobiVehicleSetupLibrary::ApplyConfiguration(GetVehicleMovementComponent(), VehicleConfiguration, CurrentSurfaceGrip);
		NitroComponent->ThrustForceNewtons = VehicleConfiguration->NitroForceNewtons;
		VehicleAudioComponent->SetEngineAudioProfile(VehicleConfiguration->EngineLoopSound, VehicleConfiguration->EngineOnLoadSound);
		VehicleAudioComponent->SetHornSound(VehicleConfiguration->HornSound);
	}
	else
	{
		UE_LOG(LogNairobiVehicle, Warning,
			TEXT("%s has no VehicleConfiguration data asset; Chaos defaults are used. Assign Content/Data/Vehicles/DA_<Vehicle>."),
			*GetName());
	}

	// Clients must not apply nitro thrust themselves in a server-authoritative race.
	NitroComponent->bApplyThrustLocally = HasAuthority() || GetNetMode() == NM_Standalone;
}

void ANairobiRaceVehiclePawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	const float SpeedKph = GetSpeedKph();
	SteeringAngleDegrees = LastInput.Steering * (VehicleConfiguration ? VehicleConfiguration->MaxSteerAngleDegrees : 30.f)
		* FMath::Clamp(1.f - (VehicleConfiguration ? VehicleConfiguration->HighSpeedSteerReduction : 0.3f) * (SpeedKph / 200.f), 0.4f, 1.f);

	UpdateWheelVisuals(DeltaSeconds);

	if (CameraRig)
	{
		CameraRig->SetSpeedKph(SpeedKph);
	}

	if (VehicleAudioComponent)
	{
		const float MaxRPM = VehicleConfiguration ? VehicleConfiguration->MaxRPM : 7500.f;
		const float IdleRPM = VehicleConfiguration ? VehicleConfiguration->IdleRPM : 900.f;
		const float RPM01 = FMath::Clamp((GetEngineRPM() - IdleRPM) / FMath::Max(1.f, MaxRPM - IdleRPM), 0.f, 1.f);
		const float Slip01 = FMath::Clamp(FMath::Abs(LastInput.Steering) * SpeedKph / 140.f, 0.f, 1.f);
		VehicleAudioComponent->UpdateEngineParameters(RPM01, LastInput.Throttle, SpeedKph, Slip01);
	}

	if (RecoveryComponent)
	{
		RecoveryComponent->ReportDriverIntent(LastInput.Throttle, SpeedKph);
	}

	// Clients stream input to the server at ~30 Hz; the server owns the race simulation.
	// A locally controlled client pawn is the autonomous proxy (RemoteRole == Authority).
	if (!HasAuthority() && IsLocallyControlled())
	{
		InputSendAccumulator += DeltaSeconds;
		if (InputSendAccumulator >= (1.f / 30.f))
		{
			InputSendAccumulator = 0.f;
			Server_SetDriverInput(LastInput);
		}
	}
}

void ANairobiRaceVehiclePawn::ApplyDriverInput(const FNairobiDriverInput& Input)
{
	FNairobiDriverInput Sanitized = Input;
	Sanitized.Steering = FMath::Clamp(Sanitized.Steering, -1.f, 1.f);
	Sanitized.Throttle = FMath::Clamp(Sanitized.Throttle, 0.f, 1.f);
	Sanitized.Brake = FMath::Clamp(Sanitized.Brake, 0.f, 1.f);

	// The server flag does not replicate to clients, so the phase is also read locally:
	// a client must not drive off the grid while the countdown is running. The server
	// still ignores any input it receives before the race starts.
	const ANairobiRaceGameState* RaceState = GetWorld() ? GetWorld()->GetGameState<ANairobiRaceGameState>() : nullptr;
	const bool bPhaseAllowsDriving = RaceState == nullptr || RaceState->IsRaceRunning();

	if (!bRaceControlEnabled || !bPhaseAllowsDriving)
	{
		Sanitized = FNairobiDriverInput();
		Sanitized.bHandbrake = true; // hold the car on the grid / after the flag
	}

	LastInput = Sanitized;
	ApplyInputToChaos(Sanitized);

	if (NitroComponent)
	{
		NitroComponent->SetBoostRequested(Sanitized.bBoost);
	}
}

void ANairobiRaceVehiclePawn::SetRaceControlEnabled(bool bEnabled)
{
	bRaceControlEnabled = bEnabled;
	if (!bEnabled)
	{
		FNairobiDriverInput Hold;
		Hold.bHandbrake = true;
		LastInput = Hold;
		ApplyInputToChaos(Hold);
	}
}

void ANairobiRaceVehiclePawn::ApplyInputToChaos(const FNairobiDriverInput& Input)
{
	UChaosWheeledVehicleMovementComponent* Movement = GetVehicleMovementComponent();
	if (Movement == nullptr)
	{
		return;
	}

	Movement->SetThrottleInput(Input.Throttle);
	Movement->SetBrakeInput(Input.Brake);
	Movement->SetSteeringInput(Input.Steering);
	Movement->SetHandbrakeInput(Input.bHandbrake);
}

void ANairobiRaceVehiclePawn::Server_SetDriverInput_Implementation(FNairobiDriverInput Input)
{
	// Server applies the same sanitised intent; the resulting Chaos state replicates.
	ApplyDriverInput(Input);
}

float ANairobiRaceVehiclePawn::GetSpeedKph() const
{
	const UChaosWheeledVehicleMovementComponent* Movement = GetVehicleMovementComponent();
	if (Movement == nullptr)
	{
		return 0.f;
	}
	return FMath::Abs(Movement->GetForwardSpeed()) * 0.036f;
}

float ANairobiRaceVehiclePawn::GetEngineRPM() const
{
	const UChaosWheeledVehicleMovementComponent* Movement = GetVehicleMovementComponent();
	return Movement ? Movement->GetEngineRotationSpeed() : 0.f;
}

FString ANairobiRaceVehiclePawn::GetGearText() const
{
	const UChaosWheeledVehicleMovementComponent* Movement = GetVehicleMovementComponent();
	if (Movement == nullptr)
	{
		return TEXT("N");
	}

	const int32 Gear = Movement->GetCurrentGear();
	if (Gear == 0)
	{
		return TEXT("N");
	}
	if (Gear < 0)
	{
		return TEXT("R");
	}
	return FString::FromInt(Gear);
}

float ANairobiRaceVehiclePawn::GetNitroCapacity01() const
{
	return NitroComponent ? NitroComponent->GetCapacity01() : 0.f;
}

float ANairobiRaceVehiclePawn::GetWheelSpinDegrees(int32 WheelIndex) const
{
	return (WheelIndex >= 0 && WheelIndex < 4) ? WheelSpinDegrees[WheelIndex] : 0.f;
}

void ANairobiRaceVehiclePawn::UpdateWheelVisuals(float DeltaSeconds)
{
	// Presentation approximation: wheel spin is integrated from forward speed. Replace
	// with per-wheel Chaos wheel state in the animation pass (Gate 3) so locked wheels
	// and suspension travel animate correctly.
	constexpr float WheelCircumferenceMeters = 2.05f;
	const float MetersPerSecond = GetSpeedKph() / 3.6f;
	const float DegreesThisFrame = (MetersPerSecond / WheelCircumferenceMeters) * 360.f * DeltaSeconds;

	for (int32 Index = 0; Index < 4; ++Index)
	{
		WheelSpinDegrees[Index] = FMath::Fmod(WheelSpinDegrees[Index] + DegreesThisFrame, 360.f);
	}
}

void ANairobiRaceVehiclePawn::ApplySurfaceGrip(float GripMultiplier)
{
	CurrentSurfaceGrip = FMath::Clamp(GripMultiplier, 0.2f, 2.f);
	if (VehicleConfiguration)
	{
		UNairobiVehicleSetupLibrary::ApplySurfaceGrip(GetVehicleMovementComponent(), VehicleConfiguration, CurrentSurfaceGrip);
	}
}

void ANairobiRaceVehiclePawn::NotifyHit(
	UPrimitiveComponent* MyComp,
	AActor* Other,
	UPrimitiveComponent* OtherComp,
	bool bSelfMoved,
	FVector HitLocation,
	FVector HitNormal,
	FVector NormalImpulse,
	const FHitResult& Hit)
{
	Super::NotifyHit(MyComp, Other, OtherComp, bSelfMoved, HitLocation, HitNormal, NormalImpulse, Hit);

	const float ImpactSpeedKph = GetSpeedKph();
	if (ImpactSpeedKph < 25.f || ImpactSpeedKph <= LastImpactSpeedKph + 5.f)
	{
		return;
	}

	LastImpactSpeedKph = ImpactSpeedKph;
	if (CameraRig)
	{
		CameraRig->TriggerImpactShake(FMath::Clamp(ImpactSpeedKph / 120.f, 0.2f, 1.f));
	}
}

void ANairobiRaceVehiclePawn::HandleCheckpointOverlap(
	UPrimitiveComponent* OverlappedComponent,
	AActor* OtherActor,
	UPrimitiveComponent* OtherComp,
	int32 OtherBodyIndex,
	bool bFromSweep,
	const FHitResult& SweepResult)
{
	const ANairobiCheckpointGate* Gate = Cast<ANairobiCheckpointGate>(OtherActor);
	if (Gate == nullptr || !bRaceControlEnabled)
	{
		return;
	}

	if (HasAuthority())
	{
		HandleCheckpointOnAuthority(Gate->GetCheckpointId());
	}
	else if (IsLocallyControlled())
	{
		// The claim travels to the server; the verdict comes back through player state.
		Server_SubmitCheckpoint(Gate->GetCheckpointId());
	}
}

void ANairobiRaceVehiclePawn::Server_SubmitCheckpoint_Implementation(int32 CheckpointId)
{
	HandleCheckpointOnAuthority(CheckpointId);
}

void ANairobiRaceVehiclePawn::HandleCheckpointOnAuthority(int32 CheckpointId)
{
	if (!HasAuthority())
	{
		return;
	}

	ANairobiRaceGameMode* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ANairobiRaceGameMode>() : nullptr;
	ANairobiRaceManager* Manager = GameMode ? GameMode->GetRaceManager() : nullptr;
	ANairobiRaceGameState* RaceState = GetWorld() ? GetWorld()->GetGameState<ANairobiRaceGameState>() : nullptr;
	ANairobiRacePlayerState* PlayerState = GetController() ? GetController()->GetPlayerState<ANairobiRacePlayerState>() : nullptr;

	if (Manager == nullptr || RaceState == nullptr || PlayerState == nullptr || !RaceState->IsRaceRunning())
	{
		return;
	}

	// Position is read from the server's authoritative transform, never from the RPC.
	Manager->SubmitCheckpoint(PlayerState, CheckpointId, GetActorLocation(), RaceState->GetServerRaceTimeSeconds());
}

void ANairobiRaceVehiclePawn::RecoverToNearestRoad()
{
	if (!HasAuthority())
	{
		return;
	}

	ANairobiRaceGameMode* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ANairobiRaceGameMode>() : nullptr;
	UNairobiRaceTrackData* Track = GameMode ? GameMode->GetTrackData() : nullptr;
	if (Track == nullptr || Track->RacingLineCm.Num() < 2)
	{
		return;
	}

	const int32 Index = Track->FindNearestRacingLineIndex(GetActorLocation());
	if (!Track->RacingLineCm.IsValidIndex(Index))
	{
		return;
	}

	const FVector Target = Track->RacingLineCm[Index];
	const FVector Next = Track->RacingLineCm[(Index + 1) % Track->RacingLineCm.Num()];
	FRotator Facing = (Next - Target).Rotation();
	Facing.Pitch = 0.f;
	Facing.Roll = 0.f;

	if (UChaosWheeledVehicleMovementComponent* Movement = GetVehicleMovementComponent())
	{
		Movement->StopMovementImmediately();
	}

	SetActorLocationAndRotation(Target + FVector(0.f, 0.f, 150.f), Facing, false, nullptr, ETeleportType::TeleportPhysics);
	LastInput = FNairobiDriverInput();
	ApplyInputToChaos(LastInput);

	UE_LOG(LogNairobiVehicle, Log, TEXT("Recovered %s to racing-line index %d."), *GetName(), Index);
}
