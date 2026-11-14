#include "GameModes/NairobiRacePlayerController.h"

#include "Camera/NairobiCameraRigComponent.h"
#include "GameModes/NairobiRaceGameState.h"
#include "Vehicles/NairobiRaceVehiclePawn.h"
#include "NairobiRacing.h"

#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"

ANairobiRacePlayerController::ANairobiRacePlayerController()
{
	PrimaryActorTick.bCanEverTick = true;
	bShowMouseCursor = false;
}

void ANairobiRacePlayerController::BeginPlay()
{
	Super::BeginPlay();

	if (IsLocalController())
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
		{
			if (DrivingMappingContext)
			{
				Subsystem->AddMappingContext(DrivingMappingContext, 0);
			}
			else
			{
				UE_LOG(LogNairobiRace, Verbose,
					TEXT("No Enhanced Input mapping context assigned; using Config/DefaultInput.ini mappings."));
			}
		}
	}
}

void ANairobiRacePlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	if (UEnhancedInputComponent* Enhanced = Cast<UEnhancedInputComponent>(InputComponent))
	{
		if (ThrottleAction)
		{
			Enhanced->BindAction(ThrottleAction, ETriggerEvent::Triggered, this, [this](const FInputActionValue& Value)
			{
				CachedInput.Throttle = FMath::Clamp(static_cast<float>(Value.Get<float>()), 0.f, 1.f);
			});
			Enhanced->BindAction(ThrottleAction, ETriggerEvent::Completed, this, [this](const FInputActionValue&)
			{
				CachedInput.Throttle = 0.f;
			});
		}
		if (SteerAction)
		{
			Enhanced->BindAction(SteerAction, ETriggerEvent::Triggered, this, [this](const FInputActionValue& Value)
			{
				CachedInput.Steering = FMath::Clamp(static_cast<float>(Value.Get<float>()), -1.f, 1.f);
			});
			Enhanced->BindAction(SteerAction, ETriggerEvent::Completed, this, [this](const FInputActionValue&)
			{
				CachedInput.Steering = 0.f;
			});
		}
		if (BrakeAction)
		{
			Enhanced->BindAction(BrakeAction, ETriggerEvent::Triggered, this, [this](const FInputActionValue& Value)
			{
				CachedInput.Brake = FMath::Clamp(static_cast<float>(Value.Get<float>()), 0.f, 1.f);
			});
			Enhanced->BindAction(BrakeAction, ETriggerEvent::Completed, this, [this](const FInputActionValue&)
			{
				CachedInput.Brake = 0.f;
			});
		}
		if (HandbrakeAction)
		{
			Enhanced->BindAction(HandbrakeAction, ETriggerEvent::Started, this, &ANairobiRacePlayerController::OnHandbrakePressed);
			Enhanced->BindAction(HandbrakeAction, ETriggerEvent::Completed, this, &ANairobiRacePlayerController::OnHandbrakeReleased);
		}
		if (BoostAction)
		{
			Enhanced->BindAction(BoostAction, ETriggerEvent::Started, this, &ANairobiRacePlayerController::OnBoostPressed);
			Enhanced->BindAction(BoostAction, ETriggerEvent::Completed, this, &ANairobiRacePlayerController::OnBoostReleased);
		}
	}

	// Legacy fallbacks: always bound, so keyboard driving works before any input assets exist.
	InputComponent->BindAxis(TEXT("Nairobi_Throttle"), this, &ANairobiRacePlayerController::OnThrottleAxis);
	InputComponent->BindAxis(TEXT("Nairobi_Steer"), this, &ANairobiRacePlayerController::OnSteerAxis);
	InputComponent->BindAction(TEXT("Nairobi_Handbrake"), IE_Pressed, this, &ANairobiRacePlayerController::OnHandbrakePressed);
	InputComponent->BindAction(TEXT("Nairobi_Handbrake"), IE_Released, this, &ANairobiRacePlayerController::OnHandbrakeReleased);
	InputComponent->BindAction(TEXT("Nairobi_Boost"), IE_Pressed, this, &ANairobiRacePlayerController::OnBoostPressed);
	InputComponent->BindAction(TEXT("Nairobi_Boost"), IE_Released, this, &ANairobiRacePlayerController::OnBoostReleased);
	InputComponent->BindAction(TEXT("Nairobi_Recover"), IE_Pressed, this, &ANairobiRacePlayerController::OnRecoverPressed);
	InputComponent->BindAction(TEXT("Nairobi_Camera"), IE_Pressed, this, &ANairobiRacePlayerController::OnCameraPressed);
	InputComponent->BindAction(TEXT("Nairobi_Pause"), IE_Pressed, this, &ANairobiRacePlayerController::OnPausePressed);
	InputComponent->BindAction(TEXT("Nairobi_LookBack"), IE_Pressed, this, &ANairobiRacePlayerController::OnLookBackPressed);
	InputComponent->BindAction(TEXT("Nairobi_LookBack"), IE_Released, this, &ANairobiRacePlayerController::OnLookBackReleased);
}

void ANairobiRacePlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	// Local prediction needs the same starting phase as the server.
	if (ANairobiRaceGameState* State = GetWorld()->GetGameState<ANairobiRaceGameState>())
	{
		if (ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(InPawn))
		{
			Vehicle->SetRaceControlEnabled(State->IsRaceRunning());
		}
	}
}

void ANairobiRacePlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	PushInputToVehicle();
}

ANairobiRaceVehiclePawn* ANairobiRacePlayerController::GetRaceVehicle() const
{
	return Cast<ANairobiRaceVehiclePawn>(GetPawn());
}

void ANairobiRacePlayerController::PushInputToVehicle()
{
	if (ANairobiRaceVehiclePawn* Vehicle = GetRaceVehicle())
	{
		Vehicle->ApplyDriverInput(CachedInput);
	}
}

void ANairobiRacePlayerController::OnThrottleAxis(float Value)
{
	CachedInput.Throttle = FMath::Clamp(Value, 0.f, 1.f);
	if (Value < 0.f)
	{
		CachedInput.Brake = FMath::Clamp(-Value, 0.f, 1.f);
	}
	else if (!IsInputKeyDown(EKeys::S))
	{
		CachedInput.Brake = 0.f;
	}
}

void ANairobiRacePlayerController::OnSteerAxis(float Value)
{
	CachedInput.Steering = FMath::Clamp(Value, -1.f, 1.f);
}

void ANairobiRacePlayerController::OnHandbrakePressed()
{
	CachedInput.bHandbrake = true;
}

void ANairobiRacePlayerController::OnHandbrakeReleased()
{
	CachedInput.bHandbrake = false;
}

void ANairobiRacePlayerController::OnBoostPressed()
{
	CachedInput.bBoost = true;
}

void ANairobiRacePlayerController::OnBoostReleased()
{
	CachedInput.bBoost = false;
}

void ANairobiRacePlayerController::OnRecoverPressed()
{
	Server_RequestVehicleRecovery();
}

void ANairobiRacePlayerController::OnCameraPressed()
{
	CycleCameraMode();
}

void ANairobiRacePlayerController::OnPausePressed()
{
	TogglePauseMenu();
}

void ANairobiRacePlayerController::OnLookBackPressed()
{
	bLookBackHeld = true;
	if (const ANairobiRaceVehiclePawn* Vehicle = GetRaceVehicle())
	{
		if (UNairobiCameraRigComponent* Rig = Vehicle->GetCameraRig())
		{
			Rig->SetLookBack(true);
		}
	}
}

void ANairobiRacePlayerController::OnLookBackReleased()
{
	bLookBackHeld = false;
	if (const ANairobiRaceVehiclePawn* Vehicle = GetRaceVehicle())
	{
		if (UNairobiCameraRigComponent* Rig = Vehicle->GetCameraRig())
		{
			Rig->SetLookBack(false);
		}
	}
}

void ANairobiRacePlayerController::CycleCameraMode()
{
	constexpr int32 ModeCount = static_cast<int32>(ENairobiCameraMode::Cockpit) + 1;
	CameraMode = static_cast<ENairobiCameraMode>((static_cast<int32>(CameraMode) + 1) % ModeCount);

	if (const ANairobiRaceVehiclePawn* Vehicle = GetRaceVehicle())
	{
		if (UNairobiCameraRigComponent* Rig = Vehicle->GetCameraRig())
		{
			Rig->SetCameraMode(CameraMode);
		}
	}
}

void ANairobiRacePlayerController::TogglePauseMenu()
{
	// Real multiplayer pause is a server decision; only standalone may pause locally.
	if (GetWorld()->GetNetMode() != NM_Standalone)
	{
		return;
	}

	bPauseMenuOpen = !bPauseMenuOpen;
	SetPause(bPauseMenuOpen);
	if (bPauseMenuOpen)
	{
		SetInputMode(FInputModeGameAndUI());
		bShowMouseCursor = true;
	}
	else
	{
		SetInputMode(FInputModeGameOnly());
		bShowMouseCursor = false;
	}
}

void ANairobiRacePlayerController::Client_ShowRaceResults_Implementation(const TArray<FNairobiRaceResult>& Results)
{
	UE_LOG(LogNairobiRace, Log, TEXT("Received %d classified result(s) from the server."), Results.Num());
	// The results widget reads ANairobiRaceGameState::GetResults(); this hook simply
	// lets Blueprint/WBP show the screen when the payload arrives.
}

void ANairobiRacePlayerController::Client_PrepareRestart_Implementation()
{
	bPauseMenuOpen = false;
	CachedInput = FNairobiDriverInput();
}

void ANairobiRacePlayerController::Client_NotifyCheckpointRejected_Implementation(int32 CheckpointId)
{
	UE_LOG(LogNairobiRace, Warning, TEXT("Server rejected checkpoint %d."), CheckpointId);
}

void ANairobiRacePlayerController::Server_RequestVehicleRecovery_Implementation()
{
	if (ANairobiRaceVehiclePawn* Vehicle = GetRaceVehicle())
	{
		Vehicle->RecoverToNearestRoad();
	}
}

void ANairobiRacePlayerController::Server_SetReady_Implementation(bool bReady)
{
	if (ANairobiRacePlayerState* PlayerState = GetPlayerState<ANairobiRacePlayerState>())
	{
		PlayerState->SetReady(bReady);
	}
}
