#include "Camera/NairobiCameraRigComponent.h"

#include "Camera/CameraComponent.h"
#include "Camera/CameraShakeBase.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"

UNairobiCameraRigComponent::UNairobiCameraRigComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;

	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	SpringArm->SetupAttachment(this);
	SpringArm->TargetArmLength = 620.f;
	SpringArm->SocketOffset = FVector(0.f, 0.f, 190.f);
	SpringArm->bUsePawnControlRotation = false;
	SpringArm->bDoCollisionTest = true;
	SpringArm->ProbeSize = 18.f;
	SpringArm->bEnableCameraLag = true;
	SpringArm->CameraLagSpeed = 9.f;
	SpringArm->CameraLagMaxDistance = 120.f;
	SpringArm->bInheritPitch = false;
	SpringArm->bInheritYaw = true;
	SpringArm->bInheritRoll = false;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("RaceCamera"));
	Camera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
	Camera->FieldOfView = 82.f;
	Camera->bUsePawnControlRotation = false;
}

void UNairobiCameraRigComponent::BeginPlay()
{
	Super::BeginPlay();
	ApplyModeSettings(true);
}

void UNairobiCameraRigComponent::SetCameraMode(ENairobiCameraMode NewMode)
{
	if (NewMode == CurrentMode)
	{
		return;
	}
	CurrentMode = NewMode;
	ApplyModeSettings(false);
}

void UNairobiCameraRigComponent::ApplyModeSettings(bool bImmediate)
{
	if (SpringArm == nullptr || Camera == nullptr)
	{
		return;
	}

	switch (CurrentMode)
	{
	case ENairobiCameraMode::Chase:
		SpringArm->TargetArmLength = 620.f;
		SpringArm->SocketOffset = FVector(0.f, 0.f, 190.f);
		SpringArm->bEnableCameraLag = true;
		SpringArm->CameraLagSpeed = 9.f;
		Camera->FieldOfView = 82.f;
		break;

	case ENairobiCameraMode::Bumper:
		SpringArm->TargetArmLength = 40.f;
		SpringArm->SocketOffset = FVector(215.f, 0.f, 58.f);
		SpringArm->bEnableCameraLag = false;
		Camera->FieldOfView = 92.f;
		break;

	case ENairobiCameraMode::Hood:
		SpringArm->TargetArmLength = 190.f;
		SpringArm->SocketOffset = FVector(90.f, 0.f, 118.f);
		SpringArm->bEnableCameraLag = false;
		Camera->FieldOfView = 88.f;
		break;

	case ENairobiCameraMode::Aerial:
		SpringArm->TargetArmLength = 2400.f;
		SpringArm->SocketOffset = FVector(0.f, 0.f, 320.f);
		SpringArm->bEnableCameraLag = true;
		SpringArm->CameraLagSpeed = 4.f;
		SpringArm->SetRelativeRotation(FRotator(-62.f, 0.f, 0.f));
		Camera->FieldOfView = 72.f;
		break;

	case ENairobiCameraMode::Cockpit:
		SpringArm->TargetArmLength = 12.f;
		SpringArm->SocketOffset = FVector(-22.f, 0.f, 132.f);
		SpringArm->bEnableCameraLag = false;
		Camera->FieldOfView = 84.f;
		break;
	}

	if (CurrentMode != ENairobiCameraMode::Aerial)
	{
		SpringArm->SetRelativeRotation(FRotator(-12.f, 0.f, 0.f));
	}

	// Remember the mode's base framing: the per-frame speed blend must chase the base,
	// never its own previous output (that would compound every frame).
	BaseArmLength = SpringArm->TargetArmLength;
	BaseFOV = Camera->FieldOfView;
	BlendedArmLength = BaseArmLength;
	BlendedFOV = BaseFOV;
	BlendedPitch = SpringArm->GetRelativeRotation().Pitch;
}

void UNairobiCameraRigComponent::SetLookBack(bool bNewLookBack)
{
	bLookBack = bNewLookBack;
	if (SpringArm)
	{
		SpringArm->SetRelativeRotation(FRotator(
			SpringArm->GetRelativeRotation().Pitch,
			bLookBack ? 180.f : 0.f,
			0.f));
	}
}

void UNairobiCameraRigComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (SpringArm == nullptr || Camera == nullptr)
	{
		return;
	}

	if (!bSpeedSensitiveFraming || CurrentMode == ENairobiCameraMode::Aerial || CurrentMode == ENairobiCameraMode::Cockpit)
	{
		return;
	}

	// Pull the camera back and widen the lens as speed rises: a 0..220 km/h ramp on top of
	// the current mode's base framing.
	const float SpeedFactor = FMath::Clamp(SpeedKph / 220.f, 0.f, 1.f);
	const float TargetArmLength = BaseArmLength * (1.f + 0.16f * SpeedFactor);
	const float TargetFOV = BaseFOV * (1.f + 0.11f * SpeedFactor);

	const float BlendSpeed = 3.5f;
	BlendedArmLength = FMath::FInterpTo(BlendedArmLength, TargetArmLength, DeltaTime, BlendSpeed);
	BlendedFOV = FMath::FInterpTo(BlendedFOV, TargetFOV, DeltaTime, BlendSpeed);

	SpringArm->TargetArmLength = BlendedArmLength;
	Camera->FieldOfView = BlendedFOV;
}

void UNairobiCameraRigComponent::TriggerImpactShake(float Magnitude01)
{
	if (ImpactShakeClass == nullptr || GetOwner() == nullptr)
	{
		return;
	}

	if (APawn* Pawn = Cast<APawn>(GetOwner()))
	{
		if (APlayerController* Controller = Cast<APlayerController>(Pawn->GetController()))
		{
			Controller->ClientStartCameraShake(ImpactShakeClass, FMath::Clamp(Magnitude01, 0.2f, 1.f));
		}
	}
}
