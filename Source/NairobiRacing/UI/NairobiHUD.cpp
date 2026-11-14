#include "UI/NairobiHUD.h"

#include "GameModes/NairobiRaceGameState.h"
#include "GameModes/NairobiRacePlayerState.h"
#include "Vehicles/NairobiRaceVehiclePawn.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "GameFramework/PlayerController.h"

ANairobiHUD::ANairobiHUD()
{
	PrimaryActorTick.bCanEverTick = false;
}

FString ANairobiHUD::FormatRaceTime(float Seconds)
{
	const int32 TotalMilliseconds = FMath::Max(0, FMath::RoundToInt(Seconds * 1000.f));
	const int32 Minutes = TotalMilliseconds / 60000;
	const int32 RemainingSeconds = (TotalMilliseconds / 1000) % 60;
	const int32 Milliseconds = TotalMilliseconds % 1000;
	return FString::Printf(TEXT("%d:%02d.%03d"), Minutes, RemainingSeconds, Milliseconds);
}

void ANairobiHUD::DrawHUD()
{
	Super::DrawHUD();

	if (Canvas == nullptr || PlayerOwner == nullptr || !PlayerOwner->IsLocalController())
	{
		return;
	}

	const ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(GetOwningPawn());
	const ANairobiRaceGameState* RaceState = GetWorld() ? GetWorld()->GetGameState<ANairobiRaceGameState>() : nullptr;

	if (RaceState == nullptr)
	{
		return;
	}

	if (Vehicle && bDrawTelemetryPanel && RaceState->GetRacePhase() != ENairobiRacePhase::Finished)
	{
		DrawTelemetry(*Vehicle);
	}

	const ANairobiRacePlayerState* PlayerState = PlayerOwner->GetPlayerState<ANairobiRacePlayerState>();
	DrawRaceStatus(*RaceState, PlayerState);

	if (RaceState->GetRacePhase() == ENairobiRacePhase::Countdown)
	{
		DrawCountdown(*RaceState);
	}
	else if (RaceState->GetRacePhase() == ENairobiRacePhase::Finished)
	{
		DrawResults(*RaceState);
	}
}

void ANairobiHUD::DrawLabel(const FString& Text, float X, float Y, const FLinearColor& Colour, float Scale, bool bLargeFont)
{
	UFont* Font = GEngine ? (bLargeFont ? GEngine->GetLargeFont() : GEngine->GetMediumFont()) : nullptr;
	if (Font == nullptr)
	{
		return;
	}
	DrawText(Text, Colour, X, Y, Font, Scale, false);
}

void ANairobiHUD::DrawBar(float X, float Y, float Width, float Height, float Fill01, const FLinearColor& FillColour)
{
	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.55f), X, Y, Width, Height);
	DrawRect(FillColour, X, Y, Width * FMath::Clamp(Fill01, 0.f, 1.f), Height);
}

void ANairobiHUD::DrawTelemetry(const ANairobiRaceVehiclePawn& Vehicle)
{
	const float BaseX = 48.f;
	const float BaseY = Canvas->ClipY - 190.f;

	const float SpeedKph = Vehicle.GetSpeedKph();
	const FString SpeedText = FString::Printf(TEXT("%d"), FMath::RoundToInt(SpeedKph));
	DrawLabel(SpeedText, BaseX, BaseY, FLinearColor::White, 2.4f, true);
	DrawLabel(TEXT("km/h"), BaseX + 110.f, BaseY + 26.f, FLinearColor(0.75f, 0.82f, 0.9f), 1.f);

	const FString GearText = FString::Printf(TEXT("GEAR %s"), *Vehicle.GetGearText());
	DrawLabel(GearText, BaseX, BaseY - 34.f, FLinearColor(0.95f, 0.78f, 0.3f), 1.2f);

	const float MaxRPM = 8000.f;
	const float Rpm01 = FMath::Clamp(Vehicle.GetEngineRPM() / MaxRPM, 0.f, 1.f);
	DrawBar(BaseX, BaseY - 60.f, 260.f, 12.f, Rpm01, FLinearColor(0.85f, 0.25f, 0.2f));

	const float Nitro01 = Vehicle.GetNitroCapacity01();
	const bool bNitroAvailable = Nitro01 >= 0.999f;
	DrawBar(BaseX, BaseY + 92.f, 260.f, 10.f, Nitro01,
		bNitroAvailable ? FLinearColor(0.2f, 0.75f, 1.f) : FLinearColor(0.35f, 0.45f, 0.6f));
	DrawLabel(bNitroAvailable ? TEXT("NITRO READY [LSHIFT]") : TEXT("NITRO CHARGING"),
		BaseX, BaseY + 106.f, FLinearColor(0.55f, 0.8f, 1.f), 1.f);
}

void ANairobiHUD::DrawRaceStatus(const ANairobiRaceGameState& RaceState, const ANairobiRacePlayerState* PlayerState)
{
	const int32 TotalRacers = RaceState.PlayerArray.Num();
	const int32 Position = PlayerState ? PlayerState->GetRacePosition() : 0;
	const int32 Lap = PlayerState ? PlayerState->GetLap() : 1;
	const int32 Checkpoints = PlayerState ? PlayerState->GetNextCheckpointIndex() : 0;
	const float BestLap = PlayerState ? PlayerState->GetBestLapSeconds() : 0.f;

	DrawLabel(FString::Printf(TEXT("P%d / %d"), Position, FMath::Max(1, TotalRacers)),
		48.f, 42.f, FLinearColor::White, 1.6f, true);
	DrawLabel(FString::Printf(TEXT("LAP %d / %d"), Lap, RaceState.GetConfiguredLaps()),
		48.f, 78.f, FLinearColor(0.95f, 0.85f, 0.4f), 1.2f);
	DrawLabel(FString::Printf(TEXT("TIME %s"), *FormatRaceTime(RaceState.GetServerRaceTimeSeconds())),
		48.f, 106.f, FLinearColor(0.82f, 0.88f, 0.95f), 1.1f);

	if (BestLap > 0.f)
	{
		DrawLabel(FString::Printf(TEXT("BEST LAP %s"), *FormatRaceTime(BestLap)),
			48.f, 132.f, FLinearColor(0.55f, 0.95f, 0.65f), 1.1f);
	}

	DrawLabel(FString::Printf(TEXT("CHECKPOINTS %d"), Checkpoints),
		Canvas->ClipX - 260.f, 42.f, FLinearColor(0.8f, 0.86f, 0.92f), 1.f);
}

void ANairobiHUD::DrawCountdown(const ANairobiRaceGameState& RaceState)
{
	const int32 Countdown = RaceState.GetCountdownSeconds();
	const FString Text = Countdown > 0 ? FString::FromInt(Countdown) : TEXT("GO!");

	const float CentreX = Canvas->ClipX * 0.5f - 30.f;
	const float CentreY = Canvas->ClipY * 0.32f;
	DrawLabel(Text, CentreX, CentreY, FLinearColor(1.f, 0.95f, 0.3f), 4.f, true);
}

void ANairobiHUD::DrawResults(const ANairobiRaceGameState& RaceState)
{
	const TArray<FNairobiRaceResult>& Results = RaceState.GetResults();
	float Y = 140.f;

	DrawLabel(TEXT("RACE RESULTS"), Canvas->ClipX * 0.5f - 110.f, Y - 56.f, FLinearColor::White, 1.8f, true);

	for (const FNairobiRaceResult& Result : Results)
	{
		const FString Line = FString::Printf(TEXT("%d. %s  %s  best %s"),
			Result.FinishPosition,
			*Result.DisplayName,
			*FormatRaceTime(Result.TotalTimeSeconds),
			*FormatRaceTime(Result.BestLapSeconds));
		DrawLabel(Line, Canvas->ClipX * 0.5f - 220.f, Y, FLinearColor(0.9f, 0.94f, 1.f), 1.1f);
		Y += 28.f;
	}
}
