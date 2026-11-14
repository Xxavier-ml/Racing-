#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/NairobiTrackRules.h"
#include "NairobiNitroComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FNairobiNitroStateChanged, int32, Phase, float, Capacity01);

/**
 * Nitrous boost with an authoritative state machine.
 *
 * The Ready/Active/Cooldown timing comes from NairobiRacing::Core::StepNitro, which is
 * unit-tested outside the engine. Only the server applies thrust in multiplayer; the
 * client mirrors the phase for HUD feedback (see NETWORKING.md).
 */
UCLASS(ClassGroup = (Nairobi), meta = (BlueprintSpawnableComponent))
class NAIROBIRACING_API UNairobiNitroComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UNairobiNitroComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Nitro")
	void SetBoostRequested(bool bRequested);

	UFUNCTION(BlueprintPure, Category = "Nitro")
	float GetCapacity01() const { return static_cast<float>(NitroState.Capacity01); }

	UFUNCTION(BlueprintPure, Category = "Nitro")
	bool IsThrusting() const { return NairobiRacing::Core::IsNitroThrusting(NitroState); }

	UFUNCTION(BlueprintPure, Category = "Nitro")
	int32 GetPhase() const { return static_cast<int32>(NitroState.Phase); }

	UPROPERTY(BlueprintAssignable, Category = "Nitro")
	FNairobiNitroStateChanged OnNitroStateChanged;

	/** Newtons of forward force while active. Set from UNairobiVehicleConfiguration. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nitro")
	float ThrustForceNewtons = 8200.f;

	/** Server authority switch: clients simulate the phase but never apply force. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nitro")
	bool bApplyThrustLocally = true;

protected:
	NairobiRacing::Core::FNitroState NitroState;
	bool bBoostRequested = false;
	int32 LastBroadcastPhase = -1;
};
