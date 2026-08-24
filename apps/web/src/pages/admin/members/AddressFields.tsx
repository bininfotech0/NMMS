import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";

export interface AddressValue {
  pincode: string;
  addressLine: string;
  landmark: string;
  latitude: string;
  longitude: string;
}

export function AddressFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
  hideCoordinates = false,
}: {
  idPrefix: string;
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  disabled?: boolean;
  /** Coordinates aren't persisted for this address (e.g. permanent address has no lat/long columns). */
  hideCoordinates?: boolean;
}) {
  const [detecting, setDetecting] = useState(false);

  function set(patch: Partial<AddressValue>) {
    onChange({ ...value, ...patch });
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
        setDetecting(false);
      },
      () => {
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-addressLine`}>Full address</Label>
        <Input
          id={`${idPrefix}-addressLine`}
          value={value.addressLine}
          disabled={disabled}
          onChange={(e) => set({ addressLine: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-landmark`}>Landmark (optional)</Label>
        <Input
          id={`${idPrefix}-landmark`}
          value={value.landmark}
          disabled={disabled}
          onChange={(e) => set({ landmark: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-pincode`}>Pincode</Label>
        <Input
          id={`${idPrefix}-pincode`}
          value={value.pincode}
          disabled={disabled}
          onChange={(e) => set({ pincode: e.target.value })}
          inputMode="numeric"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
        />
      </div>

      {!hideCoordinates && (
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm font-medium">Location Coordinates</Label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={disabled || detecting}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {detecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MapPin className="size-3.5" />
              )}
              {detecting ? "Detecting..." : "Auto-detect"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-latitude`} className="text-xs text-muted-foreground">
                Latitude
              </Label>
              <Input
                id={`${idPrefix}-latitude`}
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="e.g. 28.6139"
                value={value.latitude}
                disabled={disabled}
                onChange={(e) => set({ latitude: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-longitude`} className="text-xs text-muted-foreground">
                Longitude
              </Label>
              <Input
                id={`${idPrefix}-longitude`}
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="e.g. 77.2090"
                value={value.longitude}
                disabled={disabled}
                onChange={(e) => set({ longitude: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
