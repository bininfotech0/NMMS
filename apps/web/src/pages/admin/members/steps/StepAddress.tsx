import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "../AddressFields";
import type { StepProps } from "../wizard-types";

export function StepAddress({ form, setForm }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsappNumber">WhatsApp number</Label>
          <Input
            id="whatsappNumber"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            value={form.whatsappNumber}
            onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-heading text-sm font-semibold">Current Address</h3>
        <AddressFields
          idPrefix="current"
          value={{
            pincode: form.pincode,
            addressLine: form.addressLine,
            landmark: form.landmark,
            latitude: form.latitude ?? "",
            longitude: form.longitude ?? "",
          }}
          onChange={(next) => setForm((f) => ({ ...f, ...next }))}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold">Permanent Address</h3>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.sameAsCurrentAddress}
              onChange={(e) => setForm((f) => ({ ...f, sameAsCurrentAddress: e.target.checked }))}
            />
            Same as current address
          </label>
        </div>
        <AddressFields
          idPrefix="permanent"
          disabled={form.sameAsCurrentAddress}
          hideCoordinates={!form.sameAsCurrentAddress}
          value={
            form.sameAsCurrentAddress
              ? {
                  pincode: form.pincode,
                  addressLine: form.addressLine,
                  landmark: form.landmark,
                  latitude: form.latitude ?? "",
                  longitude: form.longitude ?? "",
                }
              : {
                  pincode: form.permPincode,
                  addressLine: form.permAddressLine,
                  landmark: form.permLandmark,
                  latitude: "",
                  longitude: "",
                }
          }
          onChange={(next) =>
            setForm((f) => ({
              ...f,
              permPincode: next.pincode,
              permAddressLine: next.addressLine,
              permLandmark: next.landmark,
            }))
          }
        />
      </div>
    </div>
  );
}
