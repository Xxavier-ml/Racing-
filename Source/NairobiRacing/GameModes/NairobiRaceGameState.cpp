#include "GameModes/NairobiRaceGameState.h"
#include "Net/UnrealNetwork.h"
#include "NairobiRacing.h"

ANairobiRaceGameState::ANairobiRaceGameState()
{
	bReplicates = true;
	PrimaryActorTick.bCanEverTick = false;
}

void ANairobiRaceGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(ANairobiRaceGameState, RacePhase);
	DOREPLIFETIME(ANairobiRaceGameState, CountdownSeconds);
	DOREPLIFETIME(ANairobiRaceGameState, ServerRaceTimeSeconds);
	DOREPLIFETIME(ANairobiRaceGameState, ConfiguredLaps);
	DOREPLIFETIME(ANairobiRaceGameState, WeatherState);
	DOREPLIFETIME(ANairobiRaceGameState, Results);
}

void ANairobiRaceGameState::SetRacePhase(ENairobiRacePhase NewPhase)
{
	if (!HasAuthority() || RacePhase == NewPhase)
	{
		return;
	}
	RacePhase = NewPhase;
	// OnRep broadcasts to listeners; calling it here keeps the server's local UI in sync
	// without a second manual broadcast.
	OnRep_RacePhase();
	UE_LOG(LogNairobiRace, Log, TEXT("Race phase -> %d"), static_cast<int32>(NewPhase));
}

void ANairobiRaceGameState::SetCountdownSeconds(int32 NewCountdown)
{
	if (!HasAuthority())
	{
		return;
	}
	CountdownSeconds = FMath::Max(0, NewCountdown);
	OnRep_CountdownSeconds();
	OnCountdownChanged.Broadcast(CountdownSeconds);
}

void ANairobiRaceGameState::SetConfiguredLaps(int32 NewLaps)
{
	if (HasAuthority())
	{
		ConfiguredLaps = FMath::Max(1, NewLaps);
	}
}

void ANairobiRaceGameState::SetWeatherState(const FNairobiWeatherState& NewWeather)
{
	if (HasAuthority())
	{
		WeatherState = NewWeather;
	}
}

void ANairobiRaceGameState::SetServerRaceTime(float NewTimeSeconds)
{
	if (HasAuthority())
	{
		ServerRaceTimeSeconds = FMath::Max(0.f, NewTimeSeconds);
	}
}

void ANairobiRaceGameState::SetResults(const TArray<FNairobiRaceResult>& NewResults)
{
	if (!HasAuthority())
	{
		return;
	}
	Results = NewResults;
	OnRep_Results();
}

void ANairobiRaceGameState::OnRep_RacePhase()
{
	OnRacePhaseChanged.Broadcast(RacePhase);
}

void ANairobiRaceGameState::OnRep_CountdownSeconds()
{
	OnCountdownChanged.Broadcast(CountdownSeconds);
}

void ANairobiRaceGameState::OnRep_Results()
{
	OnRaceResultsReady.Broadcast();
}
