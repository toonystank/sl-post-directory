"use client";

import * as React from "react";
import { useMailRoutingBeta } from "@/hooks/useMailRoutingBeta";
import {
    parseStaffStation,
    serializeStaffStation,
    STAFF_STATION_STORAGE_KEY,
    type StaffStation,
} from "@/lib/staff-station";

export type { StaffStation } from "@/lib/staff-station";

interface StaffStationContextValue {
    station: StaffStation | null;
    hydrated: boolean;
    mailRoutingEnabled: boolean;
    setStation: (station: StaffStation) => void;
    clearStation: () => void;
}

const StaffStationContext = React.createContext<StaffStationContextValue>({
    station: null,
    hydrated: false,
    mailRoutingEnabled: false,
    setStation: () => {},
    clearStation: () => {},
});

/**
 * Hydration-safe global provider for a postal employee's current Duty Station
 * and Mail Routing (Beta) gate.
 * Exposes `station = null` and `mailRoutingEnabled = false` unless the signed-in user
 * has opted into Mail Routing Beta and it is globally available.
 */
export function StaffStationProvider({ children }: { children: React.ReactNode }) {
    const { enabled: mailRoutingEnabled } = useMailRoutingBeta();
    const [rawStation, setStationState] = React.useState<StaffStation | null>(null);
    const [hydrated, setHydrated] = React.useState(false);

    React.useEffect(() => {
        try {
            const raw = window.localStorage.getItem(STAFF_STATION_STORAGE_KEY);
            setStationState(parseStaffStation(raw));
        } catch {
            // Ignore storage restrictions
        }
        setHydrated(true);

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STAFF_STATION_STORAGE_KEY) return;
            setStationState(parseStaffStation(event.newValue));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    const setStation = React.useCallback((next: StaffStation) => {
        const normalized = parseStaffStation(serializeStaffStation(next)) ?? next;
        setStationState(normalized);
        try {
            window.localStorage.setItem(
                STAFF_STATION_STORAGE_KEY,
                serializeStaffStation(normalized)
            );
        } catch {
            // Ignore quota errors
        }
    }, []);

    const clearStation = React.useCallback(() => {
        setStationState(null);
        try {
            window.localStorage.removeItem(STAFF_STATION_STORAGE_KEY);
        } catch {
            // Ignore storage restrictions
        }
    }, []);

    const station = mailRoutingEnabled ? rawStation : null;

    const value = React.useMemo(
        () => ({ station, hydrated, mailRoutingEnabled, setStation, clearStation }),
        [station, hydrated, mailRoutingEnabled, setStation, clearStation]
    );

    return (
        <StaffStationContext.Provider value={value}>
            {children}
        </StaffStationContext.Provider>
    );
}

export function useStaffStation() {
    return React.useContext(StaffStationContext);
}
