#include "Weather/NairobiWeatherSubsystem.h"

#include "GameModes/NairobiRaceGameState.h"
#include "Vehicles/NairobiRaceVehiclePawn.h"
#include "NairobiRacing.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/SkyLight.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"

bool UNairobiWeatherSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	if (const UWorld* World = Cast<UWorld>(Outer))
	{
		return World->IsGameWorld();
	}
	return false;
}

void UNairobiWeatherSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	CurrentWeather = BuildWeatherState(ENairobiWeatherType::Clear);
}

TStatId UNairobiWeatherSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UNairobiWeatherSubsystem, STATGROUP_Tickables);
}

FNairobiWeatherState UNairobiWeatherSubsystem::BuildWeatherState(ENairobiWeatherType Condition)
{
	// Values preserved from the prototype's WEATHER_PROFILES so handling behaviour
	// migrates faithfully, then extended with rain intensity and temperature.
	FNairobiWeatherState State;
	State.Condition = Condition;

	switch (Condition)
	{
	case ENairobiWeatherType::Clear:
		State.Wetness01 = 0.f;
		State.RainIntensity01 = 0.f;
		State.FogDensity = 0.00135f;
		State.GripMultiplier = 1.f;
		State.BrakeMultiplier = 1.f;
		State.VisibilityMeters = 740.f;
		State.AirTemperatureCelsius = 24.f;
		break;

	case ENairobiWeatherType::Cloudy:
		State.Wetness01 = 0.15f;
		State.RainIntensity01 = 0.f;
		State.FogDensity = 0.004f;
		State.GripMultiplier = 0.95f;
		State.BrakeMultiplier = 0.96f;
		State.VisibilityMeters = 520.f;
		State.AirTemperatureCelsius = 21.f;
		break;

	case ENairobiWeatherType::Rain:
		State.Wetness01 = 1.f;
		State.RainIntensity01 = 1.f;
		State.FogDensity = 0.0095f;
		State.GripMultiplier = 0.62f;
		State.BrakeMultiplier = 0.76f;
		State.VisibilityMeters = 240.f;
		State.AirTemperatureCelsius = 18.f;
		break;

	case ENairobiWeatherType::Night:
		State.Wetness01 = 0.f;
		State.RainIntensity01 = 0.f;
		State.FogDensity = 0.0045f;
		State.GripMultiplier = 0.98f;
		State.BrakeMultiplier = 0.99f;
		State.VisibilityMeters = 380.f;
		State.AirTemperatureCelsius = 15.f;
		break;

	case ENairobiWeatherType::Fog:
		State.Wetness01 = 0.35f;
		State.RainIntensity01 = 0.f;
		State.FogDensity = 0.025f;
		State.GripMultiplier = 0.84f;
		State.BrakeMultiplier = 0.88f;
		State.VisibilityMeters = 90.f;
		State.AirTemperatureCelsius = 16.f;
		break;
	}

	return State;
}

bool UNairobiWeatherSubsystem::HasServerAuthority() const
{
	const UWorld* World = GetWorld();
	if (World == nullptr)
	{
		return false;
	}
	return World->GetNetMode() != NM_Client;
}

void UNairobiWeatherSubsystem::SetWeather(ENairobiWeatherType NewCondition)
{
	// Server-authoritative in multiplayer: a client request is ignored and logged.
	if (!HasServerAuthority())
	{
		UE_LOG(LogNairobiWeather, Warning, TEXT("Ignoring client weather change; weather is server-authoritative."));
		return;
	}

	CurrentWeather = BuildWeatherState(NewCondition);
	ApplyWeatherToWorld();

	if (UWorld* World = GetWorld())
	{
		if (ANairobiRaceGameState* GameState = World->GetGameState<ANairobiRaceGameState>())
		{
			GameState->SetWeatherState(CurrentWeather);
		}
	}

	OnWeatherChanged.Broadcast(CurrentWeather);
	UE_LOG(LogNairobiWeather, Log, TEXT("Weather -> %d (grip %.2f)"), static_cast<int32>(NewCondition), CurrentWeather.GripMultiplier);
}

void UNairobiWeatherSubsystem::CycleWeather()
{
	static const ENairobiWeatherType Order[] = {
		ENairobiWeatherType::Clear,
		ENairobiWeatherType::Cloudy,
		ENairobiWeatherType::Rain,
		ENairobiWeatherType::Fog,
		ENairobiWeatherType::Night
	};

	int32 Index = 0;
	for (int32 Candidate = 0; Candidate < UE_ARRAY_COUNT(Order); ++Candidate)
	{
		if (Order[Candidate] == CurrentWeather.Condition)
		{
			Index = Candidate;
			break;
		}
	}
	SetWeather(Order[(Index + 1) % UE_ARRAY_COUNT(Order)]);
}

void UNairobiWeatherSubsystem::ApplyWeatherToWorld()
{
	UWorld* World = GetWorld();
	if (World == nullptr || World->GetNetMode() == NM_DedicatedServer)
	{
		return;
	}

	for (TActorIterator<AExponentialHeightFog> It(World); It; ++It)
	{
		if (UExponentialHeightFogComponent* Fog = It->GetComponent())
		{
			Fog->SetFogDensity(CurrentWeather.FogDensity);
			Fog->SetFogHeightFalloff(0.24f);
		}
	}

	const bool bIsNight = CurrentWeather.Condition == ENairobiWeatherType::Night;
	const float SunIntensity = bIsNight ? 0.05f
		: (CurrentWeather.Condition == ENairobiWeatherType::Rain ? 0.75f
			: (CurrentWeather.Condition == ENairobiWeatherType::Fog ? 0.95f : 2.75f));

	for (TActorIterator<ADirectionalLight> It(World); It; ++It)
	{
		if (UDirectionalLightComponent* Sun = Cast<UDirectionalLightComponent>(It->GetLightComponent()))
		{
			Sun->SetIntensity(SunIntensity * 3.14159f);
			Sun->SetLightColor(bIsNight ? FLinearColor(0.35f, 0.45f, 0.8f)
				: (CurrentWeather.Condition == ENairobiWeatherType::Rain ? FLinearColor(0.65f, 0.72f, 0.85f)
					: FLinearColor(1.f, 0.82f, 0.6f)));
		}
	}

	for (TActorIterator<ASkyLight> It(World); It; ++It)
	{
		if (USkyLightComponent* Sky = It->GetLightComponent())
		{
			Sky->SetIntensity(bIsNight ? 0.2f : 1.0f);
			Sky->RecaptureSky();
		}
	}

	// Weather must change handling: feed grip into every active Chaos vehicle.
	for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
	{
		if (const APlayerController* Controller = It->Get())
		{
			if (ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(Controller->GetPawn()))
			{
				Vehicle->ApplySurfaceGrip(CurrentWeather.GripMultiplier);
			}
		}
	}
}

void UNairobiWeatherSubsystem::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!bAutoCycleWeather || !HasServerAuthority())
	{
		return;
	}

	CycleAccumulator += DeltaTime;
	if (CycleAccumulator >= AutoCyclePeriodSeconds)
	{
		CycleAccumulator = 0.f;
		CycleWeather();
	}
}
