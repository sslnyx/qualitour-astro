import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import "./booking-location-select.css";

export type BookingLocationOption = {
  id: string;
  label: string;
};

export type BookingLocationSelectProps = {
  label: string;
  placeholder: string;
  value: string;
  options: readonly BookingLocationOption[];
  onChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export function BookingLocationSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
}: BookingLocationSelectProps) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [invalid, setInvalid] = useState(false);

  const labelId = `${generatedId}-label`;
  const valueId = `${generatedId}-value`;
  const listId = `${generatedId}-listbox`;
  const selectedIndex = options.findIndex((option) => option.id === value);
  const selectedOption =
    selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const optionId = (index: number) => `${generatedId}-option-${index}`;

  const openMenu = (preferredIndex = selectedIndex) => {
    if (disabled) return;
    setActiveIndex(
      options.length ? (preferredIndex >= 0 ? preferredIndex : 0) : -1,
    );
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.id !== value) onChange(option.id);
    setInvalid(false);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(
        `[id="${CSS.escape(optionId(activeIndex))}"]`,
      )
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (value) setInvalid(false);
  }, [value]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  const move = (step: 1 | -1) => {
    if (!options.length) return;
    setActiveIndex((current) => {
      const start = current >= 0 ? current : selectedIndex;
      return (start + step + options.length) % options.length;
    });
  };

  const findByTypeahead = (key: string) => {
    typeaheadRef.current += key.toLocaleLowerCase();
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadRef.current = "";
    }, 650);

    const query = typeaheadRef.current;
    const start = activeIndex >= 0 ? activeIndex + 1 : 0;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(query)) {
        setActiveIndex(index);
        return;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (open) move(1);
        else openMenu();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) move(-1);
        else openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
        break;
      case "Home":
        event.preventDefault();
        if (!open) openMenu(0);
        else setActiveIndex(options.length ? 0 : -1);
        break;
      case "End":
        event.preventDefault();
        if (!open) openMenu(options.length - 1);
        else setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open && activeIndex >= 0) choose(activeIndex);
        else if (!open) openMenu();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          if (!open) openMenu();
          findByTypeahead(event.key);
        }
    }
  };

  return (
    <div
      className="qt-field qb-full qb-location-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="qb-location-select__label" id={labelId}>
        {label}
      </span>
      <select
        className="qb-location-select__native"
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          openMenu();
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        className="qb-location-select__trigger"
        type="button"
        role="combobox"
        aria-autocomplete="none"
        aria-controls={listId}
        aria-expanded={open}
        aria-required={required || undefined}
        aria-invalid={(invalid && !value) || undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-activedescendant={
          open && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
      >
        <span
          id={valueId}
          className={selectedOption ? undefined : "is-placeholder"}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="qb-location-select__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={listRef}
          className="qb-location-select__menu"
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
        >
          {options.length ? (
            options.map((option, index) => (
              <button
                key={option.id}
                className="qb-location-select__option"
                id={optionId(index)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={option.id === value}
                data-active={index === activeIndex || undefined}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.id === value ? (
                  <span
                    className="qb-location-select__check"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <span className="qb-location-select__empty">{placeholder}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
