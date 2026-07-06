import { useMemo, useState } from "react";
import { useInventoryLocations } from "@/hooks/settings/useInventoryLocations";

function SettingsCheckbox({ label, details, checked, onChange, disabled = false }) {
    return (
        <div className="settings-checkbox">
            <s-checkbox
                label={label}
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            {details && <small className="settings-checkbox__details">{details}</small>}
        </div>
    );
}

function LocationTag({ name, onRemove }) {
    return (
        <span className="settings-location-tag">
            <span className="settings-location-tag__label">{name}</span>
            <button
                type="button"
                className="settings-location-tag__remove"
                aria-label={`Remove ${name}`}
                onClick={onRemove}
            >
                ×
            </button>
        </span>
    );
}

export default function InventoryManagementForm({ settings, onChange }) {
    const [addSelectValue, setAddSelectValue] = useState("");
    const { locations, loading: locationsLoading } = useInventoryLocations(true);

    const selectedIds = settings.inventoryLocationIds ?? [];

    const locationMap = useMemo(
        () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
        [locations]
    );

    const availableLocations = useMemo(
        () => locations.filter((location) => !selectedIds.includes(location.id)),
        [locations, selectedIds]
    );

    const update = (key, value) => {
        onChange({ ...settings, [key]: value });
    };

    const addLocation = (locationId) => {
        if (!locationId || selectedIds.includes(locationId)) {
            return;
        }

        update("inventoryLocationIds", [...selectedIds, locationId]);
        setAddSelectValue("");
    };

    const removeLocation = (locationId) => {
        update(
            "inventoryLocationIds",
            selectedIds.filter((id) => id !== locationId)
        );
    };

    const inventoryEnabled = settings.checkInventoryBeforeOrders;

    return (
        <div className="settings-rows">
            <div className="settings-card settings-card--wide">
                <h4 className="settings-card__title">Inventory management</h4>
                <p className="settings-card__description">
                    Control how inventory is checked before subscription orders are processed.
                </p>

                <SettingsCheckbox
                    label="Check inventory before processing subscription orders"
                    details="When enabled, orders will not be placed if products are out of stock or have been removed."
                    checked={settings.checkInventoryBeforeOrders}
                    onChange={(value) => update("checkInventoryBeforeOrders", value)}
                />

                <div
                    className={`settings-inventory-locations${!inventoryEnabled ? " settings-inventory-locations--disabled" : ""}`}
                >
                    <h5 className="settings-inventory-locations__title">
                        Inventory locations to check
                    </h5>
                    <p className="settings-inventory-locations__hint">
                        If no locations are selected, inventory will be checked at all locations.
                    </p>

                    {selectedIds.length > 0 && (
                        <div className="settings-location-tags">
                            {selectedIds.map((locationId) => (
                                <LocationTag
                                    key={locationId}
                                    name={locationMap[locationId] ?? locationId}
                                    onRemove={() => removeLocation(locationId)}
                                />
                            ))}
                        </div>
                    )}

                    <s-select
                        label="Add location"
                        value={addSelectValue}
                        disabled={!inventoryEnabled || locationsLoading}
                        onChange={(e) => {
                            const value = e.target.value;
                            setAddSelectValue(value);
                            addLocation(value);
                        }}
                    >
                        <s-option value="">
                            {locationsLoading ? "Loading locations..." : "Select a location"}
                        </s-option>
                        {availableLocations.map((location) => (
                            <s-option key={location.id} value={location.id}>
                                {location.name}
                            </s-option>
                        ))}
                    </s-select>
                </div>

                <div className="settings-banner-stack">
                    <s-banner tone="info">
                        <s-paragraph>
                            We check inventory at the selected locations to decide whether billing
                            should be attempted. Shopify still controls the renewal fulfillment
                            location, so an order may fail if that location is out of stock.
                        </s-paragraph>
                    </s-banner>
                </div>

                <div className="settings-checkbox-stack">
                    <SettingsCheckbox
                        label="Place partial orders (excluding out-of-stock items)?"
                        details="Process orders with available products while skipping any out-of-stock items."
                        checked={settings.inventoryPlacePartialOrders}
                        disabled={!inventoryEnabled}
                        onChange={(value) => update("inventoryPlacePartialOrders", value)}
                    />
                    <SettingsCheckbox
                        label="Also check inventory of items inside Build-a-Box bundles"
                        details="Applies to fixed-pricing Build-a-Box subscriptions. Partial orders are not supported for these bundles."
                        checked={settings.inventoryCheckBuildABox}
                        disabled={!inventoryEnabled}
                        onChange={(value) => update("inventoryCheckBuildABox", value)}
                    />
                    <SettingsCheckbox
                        label="Retry orders when products were out of stock?"
                        details="Automatically retry processing orders that were previously skipped due to inventory issues."
                        checked={settings.inventoryRetryOutOfStock}
                        disabled={!inventoryEnabled}
                        onChange={(value) => update("inventoryRetryOutOfStock", value)}
                    />
                </div>

                <div className="settings-banner-stack">
                    <s-banner tone="info">
                        <s-paragraph>
                            When inventory check is enabled, we notify customers when their order
                            cannot be processed due to stock unavailability. You can customize this
                            notification <s-link href="#">here</s-link>.
                        </s-paragraph>
                    </s-banner>
                </div>
            </div>
        </div>
    );
}
