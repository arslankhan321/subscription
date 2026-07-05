export default function PlanSaveBar({
    id,
    onSave,
    onDiscard,
    saving = false,
    saveLabel = "Save",
}) {
    const handleSave = (event) => {
        event.preventDefault();
        if (!saving) onSave();
    };

    const handleDiscard = (event) => {
        event.preventDefault();
        if (!saving) onDiscard();
    };

    return (
        <ui-save-bar id={id}>
            <button type="button" variant="primary" disabled={saving} onClick={handleSave}>
                {saveLabel}
            </button>
            <button type="button" disabled={saving} onClick={handleDiscard}>
                Discard
            </button>
        </ui-save-bar>
    );
}
