import { useState } from "react";

const MAX_TAG_LENGTH = 40;

function parseInputValue(value) {
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export default function TagInputField({
    title,
    tags = [],
    helperText,
    onChange,
    onReset,
}) {
    const [inputValue, setInputValue] = useState("");

    const addTags = (rawTags) => {
        const nextTags = [...tags];

        for (const rawTag of rawTags) {
            const tag = rawTag.trim();

            if (!tag || tag.length > MAX_TAG_LENGTH || nextTags.includes(tag)) {
                continue;
            }

            nextTags.push(tag);
        }

        if (nextTags.length !== tags.length) {
            onChange(nextTags);
        }
    };

    const removeTag = (tagToRemove) => {
        onChange(tags.filter((tag) => tag !== tagToRemove));
    };

    const handleKeyDown = (event) => {
        if (event.key === "," || event.key === "Enter") {
            event.preventDefault();

            const pending = inputValue.replace(/,$/, "").trim();

            if (pending) {
                addTags([pending]);
            }

            setInputValue("");
        } else if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
        }
    };

    const handleBlur = () => {
        const pending = inputValue.trim();

        if (pending) {
            addTags(parseInputValue(pending));
            setInputValue("");
        }
    };

    const handlePaste = (event) => {
        const pasted = event.clipboardData.getData("text");

        if (!pasted.includes(",")) {
            return;
        }

        event.preventDefault();
        addTags(parseInputValue(pasted));
        setInputValue("");
    };

    return (
        <div className="settings-tag-card">
            <div className="settings-tag-card__header">
                <h4 className="settings-tag-card__title">{title}</h4>
                <s-button
                    icon="refresh"
                    variant="tertiary"
                    accessibilityLabel={`Reset ${title}`}
                    onClick={onReset}
                />
            </div>

            <div className="settings-tag-input">
                {tags.length > 0 && (
                    <div className="settings-tag-input__tags">
                        {tags.map((tag) => (
                            <span key={tag} className="settings-tag-pill">
                                <span className="settings-tag-pill__label">{tag}</span>
                                <button
                                    type="button"
                                    className="settings-tag-pill__remove"
                                    aria-label={`Remove ${tag}`}
                                    onClick={() => removeTag(tag)}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <input
                    type="text"
                    className="settings-tag-input__field"
                    value={inputValue}
                    placeholder="Enter tag and press comma"
                    maxLength={MAX_TAG_LENGTH}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onPaste={handlePaste}
                />
            </div>

            {helperText && <small className="settings-tag-card__helper">{helperText}</small>}
        </div>
    );
}
