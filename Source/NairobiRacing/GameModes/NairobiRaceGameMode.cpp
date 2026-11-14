#include "GameModes/NairobiRaceGameMode.h"

#include "AI/NairobiRivalAIController.h"
#include "GameModes/NairobiRaceGameState.h"
#include "GameModes/NairobiRacePlayerState.h"
#include "GameModes/NairobiRacePlayerController.h"
#include "Race/NairobiRaceManager.h"
#include "Traffic/NairobiTrafficManager.h"
#include "UI/NairobiHUD.h"
#include "Vehicles/NairobiRaceVehiclePawn.h"
#include "World/NairobiRaceTrackData.h"
#include "World/NairobiTrackBuilder.h"
#include "NairobiRacing.h"

#include "Engine/World.h"
#include "EngineUtils.h"
#include "TimerManager.h"

ANairobiRaceGameMode::ANairobiRaceGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;

	GameStateClass = ANairobiRaceGameState::StaticClass();
	PlayerStateClass = ANairobiRacePlayerState::StaticClass();
	PlayerControllerClass = ANairobiRacePlayerController::StaticClass();
	DefaultPawnClass = ANairobiRaceVehiclePawn::StaticClass();
	HUDClass = ANairobiHUD::StaticClass();

	RaceManagerClass = ANairobiRaceManager::StaticClass();
	CountdownSeconds = 3;
	RaceLaps = 3;
}

void ANairobiRaceGameMode::StartPlay()
{
	Super::StartPlay();
	InitializeRace();
}

void ANairobiRaceGameMode::InitializeRace()
{
	if (bRaceInitialized || !HasAuthority())
	{
		return;
	}
	bRaceInitialized = true;

	if (RaceManager == nullptr)
	{
		FActorSpawnParameters SpawnParams;
		SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		RaceManager = GetWorld()->SpawnActor<ANairobiRaceManager>(
			RaceManagerClass ? RaceManagerClass : ANairobiRaceManager::StaticClass(),
			FTransform::Identity,
			SpawnParams);
	}

	if (RaceManager && TrackData)
	{
		RaceManager->InitializeRace(TrackData, RaceLaps, 0.f);
	}

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		State->SetConfiguredLaps(RaceLaps);
		State->SetRacePhase(ENairobiRacePhase::Lobby);
	}

	if (TrackData == nullptr)
	{
		UE_LOG(LogNairobiRace, Error, TEXT("ANairobiRaceGameMode has no TrackData asset; assign Content/Data/Track/DA_NairobiCircuit."));
		return;
	}

	if (!HasAuthority())
	{
		return;
	}

	// Greybox the circuit from track data when the map does not already contain a builder.
	bool bBuilderPresent = false;
	for (TActorIterator<ANairobiTrackBuilder> It(GetWorld()); It; ++It)
	{
		bBuilderPresent = true;
		It->BuildTrack(TrackData);
		break;
	}
	if (!bBuilderPresent)
	{
		if (ANairobiTrackBuilder* Builder = GetWorld()->SpawnActor<ANairobiTrackBuilder>())
		{
			Builder->BuildTrack(TrackData);
		}
	}

	// City traffic is ambience: spawned on the host and culled by distance.
	bool bTrafficPresent = false;
	for (TActorIterator<ANairobiTrafficManager> It(GetWorld()); It; ++It)
	{
		bTrafficPresent = true;
		It->BuildTrafficFleet(TrackData);
		break;
	}
	if (!bTrafficPresent && SelectedMode == ENairobiGameMode::FreeDrive)
	{
		if (ANairobiTrafficManager* Traffic = GetWorld()->SpawnActor<ANairobiTrafficManager>())
		{
			Traffic->BuildTrafficFleet(TrackData);
		}
	}
}

void ANairobiRaceGameMode::StartRaceCountdown()
{
	if (!HasAuthority() || bCountdownRunning)
	{
		return;
	}

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		State->SetRacePhase(ENairobiRacePhase::Countdown);
		State->SetServerRaceTime(0.f);
	}

	OfficialRaceClock = 0.f;
	RemainingCountdown = FMath::Max(0, CountdownSeconds);
	bCountdownRunning = true;
	ApplyRaceControlToVehicles(false);

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		State->SetCountdownSeconds(RemainingCountdown);
	}

	if (RemainingCountdown <= 0)
	{
		BeginRace();
		return;
	}

	GetWorldTimerManager().SetTimer(
		CountdownTimerHandle,
		this,
		&ANairobiRaceGameMode::OnCountdownTick,
		1.0f,
		true);
}

void ANairobiRaceGameMode::OnCountdownTick()
{
	if (!HasAuthority())
	{
		return;
	}

	RemainingCountdown = FMath::Max(0, RemainingCountdown - 1);

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		State->SetCountdownSeconds(RemainingCountdown);
	}

	if (RemainingCountdown <= 0)
	{
		GetWorldTimerManager().ClearTimer(CountdownTimerHandle);
		BeginRace();
	}
}

void ANairobiRaceGameMode::SpawnRivals()
{
	if (!HasAuthority() || RivalCount <= 0 || TrackData == nullptr)
	{
		return;
	}

	// Rivals are real Chaos vehicles on the grid, not position offsets in a table.
	const TSubclassOf<ANairobiRaceVehiclePawn> PawnClass = RivalPawnClass ? RivalPawnClass : ANairobiRaceVehiclePawn::StaticClass();

	for (int32 Index = 0; Index < RivalCount; ++Index)
	{
		const int32 Slot = NextGridSlot++;
		const FVector Location = TrackData->GetGridSlotLocation(Slot);
		const FRotator Rotation(0.f, FMath::RadiansToDegrees(TrackData->GetGridSlotYaw(Slot)), 0.f);

		FActorSpawnParameters SpawnParams;
		SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

		ANairobiRaceVehiclePawn* Rival = GetWorld()->SpawnActor<ANairobiRaceVehiclePawn>(
			PawnClass, Location + FVector(0.0, 0.0, 140.0), Rotation, SpawnParams);
		if (Rival == nullptr)
		{
			continue;
		}

		// A player state is required for standings/results, so the AI controller is
		// created with bWantsPlayerState before possession.
		ANairobiRivalAIController* AIController = GetWorld()->SpawnActor<ANairobiRivalAIController>();
		if (AIController)
		{
			AIController->bWantsPlayerState = true;
			AIController->Possess(Rival);
			AIController->ConfigureSkill(FMath::FRandRange(0.88f, 0.99f), FMath::FRandRange(-250.f, 250.f), Slot);

			if (ANairobiRacePlayerState* RivalState = AIController->GetPlayerState<ANairobiRacePlayerState>())
			{
				RivalState->SetPlayerName(FString::Printf(TEXT("Rival %d"), Index + 1));
				RivalState->SetVehicleId(TEXT("nganya-111-turbo"));
				if (RaceManager)
				{
					RaceManager->RegisterRacer(RivalState);
				}
			}
		}

		RivalVehicles.Add(Rival);
	}

	UE_LOG(LogNairobiRace, Log, TEXT("Spawned %d AI rival(s)."), RivalVehicles.Num());
}

void ANairobiRaceGameMode::BeginRace()
{
	if (!HasAuthority())
	{
		return;
	}

	bCountdownRunning = false;
	OfficialRaceClock = 0.f;

	if (RaceManager)
	{
		RaceManager->InitializeRace(TrackData, RaceLaps, 0.f);
	}

	// Grid the AI once, on the first race start (restart keeps the same field).
	if (RivalVehicles.Num() == 0)
	{
		SpawnRivals();
	}

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		State->SetServerRaceTime(0.f);
		State->SetRacePhase(ENairobiRacePhase::Racing);
	}
	ApplyRaceControlToVehicles(true);

	UE_LOG(LogNairobiRace, Log, TEXT("Race started: %d lap(s), track=%s"),
		RaceLaps,
		TrackData ? *TrackData->TrackName.ToString() : TEXT("unassigned"));
}

void ANairobiRaceGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!HasAuthority() || RaceManager == nullptr)
	{
		return;
	}

	ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>();
	if (State == nullptr || !State->IsRaceRunning())
	{
		return;
	}

	OfficialRaceClock += DeltaSeconds;
	State->SetServerRaceTime(OfficialRaceClock);

	// Authoritative standings are recomputed on the server every frame; clients only
	// ever read the replicated per-player position.
	RaceManager->UpdateStandings(OfficialRaceClock);

	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		const ANairobiRacePlayerController* Controller = Cast<ANairobiRacePlayerController>(It->Get());
		if (Controller == nullptr)
		{
			continue;
		}
		ANairobiRacePlayerState* PlayerState = Controller->GetPlayerState<ANairobiRacePlayerState>();
		const ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(Controller->GetPawn());
		if (PlayerState && Vehicle && !PlayerState->HasFinished())
		{
			RaceManager->RecordGhostSample(
				PlayerState,
				Vehicle->GetActorLocation(),
				FMath::DegreesToRadians(Vehicle->GetActorRotation().Yaw),
				OfficialRaceClock);
		}
	}

	if (RaceManager->AreAllRacersFinished())
	{
		FinishRace();
		return;
	}

	if (OfficialRaceClock >= MaximumRaceDurationSeconds)
	{
		UE_LOG(LogNairobiRace, Warning, TEXT("Race hit the %.0fs duration cap; forcing results."), MaximumRaceDurationSeconds);
		FinishRace();
	}
}

void ANairobiRaceGameMode::PostLogin(APlayerController* NewPlayer)
{
	Super::PostLogin(NewPlayer);

	RegisterRacer(NewPlayer);

	if (ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>())
	{
		if (State->GetRacePhase() == ENairobiRacePhase::Lobby)
		{
			StartRaceCountdown();
		}
	}
}

void ANairobiRaceGameMode::RegisterRacer(APlayerController* NewPlayer)
{
	if (!HasAuthority() || NewPlayer == nullptr || RaceManager == nullptr)
	{
		return;
	}

	ANairobiRacePlayerState* PlayerState = NewPlayer->GetPlayerState<ANairobiRacePlayerState>();
	if (PlayerState == nullptr)
	{
		return;
	}

	PlayerState->SetVehicleId(TEXT("safari-rally-gt"));
	RaceManager->RegisterRacer(PlayerState);
}

void ANairobiRaceGameMode::Logout(AController* Exiting)
{
	if (HasAuthority() && RaceManager && Exiting)
	{
		if (ANairobiRacePlayerState* PlayerState = Exiting->GetPlayerState<ANairobiRacePlayerState>())
		{
			// Disconnected racers keep their last validated result but stop blocking
			// race completion. Explicit policy, see NETWORKING.md.
			RaceManager->UnregisterRacer(PlayerState);
		}
	}
	Super::Logout(Exiting);
}

APawn* ANairobiRaceGameMode::SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot)
{
	FTransform SpawnTransform = FTransform::Identity;

	if (TrackData && TrackData->GridSlots.Num() > 0)
	{
		const FVector Location = TrackData->GetGridSlotLocation(NextGridSlot);
		const float YawRadians = TrackData->GetGridSlotYaw(NextGridSlot);
		const FRotator Rotation(0.f, FMath::RadiansToDegrees(YawRadians), 0.f);
		SpawnTransform = FTransform(Rotation, Location + FVector(0.0, 0.0, 120.0));
		NextGridSlot = (NextGridSlot + 1) % FMath::Max(1, TrackData->GridSlots.Num());
	}
	else if (TrackData && TrackData->RacingLineCm.Num() >= 2)
	{
		// No authored grid yet: stagger the field behind the start of the racing line.
		const FVector Start = TrackData->RacingLineCm[0];
		const FVector Forward = (TrackData->RacingLineCm[1] - Start).GetSafeNormal2D();
		const FVector Right(-Forward.Y, Forward.X, 0.f);
		const int32 Slot = NextGridSlot;
		const FVector Location = Start - Forward * (static_cast<float>(Slot) * 700.f)
			+ Right * (static_cast<float>(Slot % 2 == 0 ? -1 : 1) * 300.f);
		const FRotator Rotation(0.f, Forward.Rotation().Yaw, 0.f);
		SpawnTransform = FTransform(Rotation, Location + FVector(0.0, 0.0, 140.0));
		NextGridSlot = Slot + 1;
	}
	else if (StartSpot)
	{
		SpawnTransform = StartSpot->GetActorTransform();
	}

	return SpawnDefaultPawnAtTransform_Implementation(NewPlayer, SpawnTransform);
}

void ANairobiRaceGameMode::FinishRace()
{
	if (!HasAuthority() || RaceManager == nullptr)
	{
		return;
	}

	ANairobiRaceGameState* State = GetGameState<ANairobiRaceGameState>();
	if (State == nullptr || State->GetRacePhase() == ENairobiRacePhase::Finished)
	{
		return;
	}

	State->SetRacePhase(ENairobiRacePhase::Finished);
	const TArray<FNairobiRaceResult> Results = RaceManager->BuildResults();
	State->SetResults(Results);
	ApplyRaceControlToVehicles(false);

	UE_LOG(LogNairobiRace, Log, TEXT("Race finished with %d classified racer(s)."), Results.Num());
}

void ANairobiRaceGameMode::RestartRace()
{
	if (!HasAuthority())
	{
		return;
	}

	OfficialRaceClock = 0.f;
	NextGridSlot = 0;

	// Clear the previous field; SpawnRivals rebuilds it on the next BeginRace.
	for (ANairobiRaceVehiclePawn* Rival : RivalVehicles)
	{
		if (Rival)
		{
			Rival->Destroy();
		}
	}
	RivalVehicles.Reset();

	if (RaceManager)
	{
		RaceManager->InitializeRace(TrackData, RaceLaps, 0.f);
	}

	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		if (ANairobiRacePlayerController* Controller = Cast<ANairobiRacePlayerController>(It->Get()))
		{
			Controller->Client_PrepareRestart();
		}
	}

	StartRaceCountdown();
}

void ANairobiRaceGameMode::ApplyRaceControlToVehicles(bool bEnabled) const
{
	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		if (const APlayerController* Controller = It->Get())
		{
			if (ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(Controller->GetPawn()))
			{
				Vehicle->SetRaceControlEnabled(bEnabled);
			}
		}
	}
}
