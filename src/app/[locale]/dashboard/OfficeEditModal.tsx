"use client";

import { useState, useEffect, useRef } from "react";
import { Save, AlertCircle, Building, Loader2, X, Search, Building2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Field {
    id: string;
    name: string;
    value: string;
}

interface Office {
    id: string;
    name: string;
    postalCode: string;
    fields: Field[];
    controllingOffice?: { id: string; name: string; postalCode: string } | null;
    controlledOffices?: Array<{ id: string; name: string; postalCode: string }>;
}

interface OfficeEditModalProps {
    officeId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function OfficeEditModal({ officeId, onClose, onSaved }: OfficeEditModalProps) {
    const [office, setOffice] = useState<Office | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    
    // Relational state
    const [controllingOffice, setControllingOffice] = useState<{id: string, name: string} | null>(null);
    const [controlledOffices, setControlledOffices] = useState<Array<{id: string, name: string}>>([]);
    
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, postalCode: string}>>([]);
    const [searching, setSearching] = useState(false);
    const [activeSearchTarget, setActiveSearchTarget] = useState<"controlling" | "controlled" | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (officeId) {
            fetchOfficeData();
        } else {
            setOffice(null);
            setMessage("");
            setError(false);
            setControllingOffice(null);
            setControlledOffices([]);
        }
    }, [officeId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setActiveSearchTarget(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!searchQuery || !activeSearchTarget) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/offices?q=${encodeURIComponent(searchQuery)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.offices || []);
                }
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, activeSearchTarget]);

    const fetchOfficeData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/office/${officeId}`);
            if (res.ok) {
                const data = await res.json();
                setOffice(data.office);
                if (data.office.controllingOffice) {
                    setControllingOffice(data.office.controllingOffice);
                } else {
                    setControllingOffice(null);
                }
                if (data.office.controlledOffices) {
                    setControlledOffices(data.office.controlledOffices);
                } else {
                    setControlledOffices([]);
                }
            } else {
                setError(true);
                setMessage("Failed to load office data.");
            }
        } catch (err) {
            setError(true);
            setMessage("Network error loading office.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!office) return;
        
        setSaving(true);
        setMessage("");
        setError(false);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        
        // Add relational data
        const payload = {
            ...data,
            controllingOfficeId: controllingOffice ? controllingOffice.id : null,
            controlledOfficesIds: controlledOffices.map(o => o.id)
        };

        try {
            const res = await fetch(`/api/admin/office/${office.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setMessage("Post office edited successfully!");
                setTimeout(() => {
                    onSaved();
                }, 1000);
            } else {
                const errData = await res.json();
                setError(true);
                setMessage(errData.error || "An error occurred while saving.");
            }
        } catch (err) {
            setError(true);
            setMessage("A network error occurred.");
        } finally {
            setSaving(false);
        }
    };
    
    const handleSelectResult = (result: {id: string, name: string}) => {
        if (result.id === office?.id) {
            alert("An office cannot control itself!");
            return;
        }
        
        if (activeSearchTarget === "controlling") {
            // Prevent circular logic simply
            if (controlledOffices.find(c => c.id === result.id)) {
                alert("This office is already listed as a sub-office!");
                return;
            }
            setControllingOffice(result);
        } else if (activeSearchTarget === "controlled") {
            if (controllingOffice?.id === result.id) {
                alert("This office is the controlling office!");
                return;
            }
            if (!controlledOffices.find(c => c.id === result.id)) {
                setControlledOffices([...controlledOffices, result]);
            }
        }
        
        setSearchQuery("");
        setActiveSearchTarget(null);
    };

    const removeControlled = (idToRemove: string) => {
        setControlledOffices(controlledOffices.filter(o => o.id !== idToRemove));
    };

    return (
        <Dialog open={!!officeId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] max-h-[90vh] overflow-y-auto bg-card border-border/50 shadow-2xl p-0">
                <DialogHeader className="p-6 md:p-8 bg-card/80 border-b border-border/40 sticky top-0 z-20 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                            <Building className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-2xl font-extrabold tracking-tight">
                                {loading ? "Loading..." : office ? `Edit ${office.name}` : "Edit Office"}
                            </DialogTitle>
                            <DialogDescription className="text-sm mt-1">
                                Direct database editor
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 md:p-8 relative">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : office ? (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            
                            {/* Warnings & Messages */}
                            {message && (
                                <div className={`p-4 rounded-xl text-sm font-medium ${error ? 'bg-destructive/10 border border-destructive/20 text-destructive' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                                    {message}
                                </div>
                            )}
                            
                            <div className="bg-destructive/5 border border-destructive/10 rounded-2xl p-4 flex gap-3 text-sm text-muted-foreground">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 text-destructive mt-0.5" />
                                <p>
                                    Warning: You are directly editing the live database entry. These changes will be public immediately upon saving.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left Column: Basic & Dynamic Fields */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                            Basic Information
                                        </h3>
                                        <Separator className="opacity-50" />

                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Office Name</label>
                                            <Input type="text" name="name" defaultValue={office.name} required className="py-5 rounded-xl bg-background/50 focus:bg-background" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code</label>
                                            <Input type="text" name="postalCode" defaultValue={office.postalCode} required className="py-5 rounded-xl bg-background/50 focus:bg-background" />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                            Additional Fields
                                        </h3>
                                        <Separator className="opacity-50" />

                                        {office.fields.map(field => (
                                            <div key={field.id}>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">{field.name}</label>
                                                <Input type="text" name={`field_${field.name}`} defaultValue={field.value} className="py-5 rounded-xl bg-background/50 focus:bg-background" />
                                            </div>
                                        ))}

                                        <div className="pt-2">
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Add New Field</label>
                                            <div className="flex gap-3">
                                                <Input type="text" name="newFieldName" placeholder="Field name (e.g. Fax)" className="flex-1 py-5 rounded-xl bg-background/50 focus:bg-background" />
                                                <Input type="text" name="newFieldValue" placeholder="Value (Requires name too)" className="flex-1 py-5 rounded-xl bg-background/50 focus:bg-background" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Relational Data */}
                                <div className="space-y-6">
                                    <div className="space-y-4 bg-primary/5 border border-primary/10 rounded-2xl p-6">
                                        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                            <Network className="w-5 h-5 text-primary" /> Network Hierarchy
                                        </h3>
                                        <p className="text-xs text-muted-foreground">Assigning a controlling office or sub-offices will automatically update relationships across the database.</p>
                                        <Separator className="opacity-50 border-primary/20" />

                                        {/* Controlling Office Section */}
                                        <div className="pt-2">
                                            <label className="block text-sm font-bold text-primary mb-2">Controlling Office (Parent)</label>
                                            
                                            {controllingOffice ? (
                                                <div className="flex items-center justify-between p-3 bg-background border border-border/50 rounded-xl">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                                        <span className="font-medium">{controllingOffice.name}</span>
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-7 px-2 text-destructive hover:bg-destructive/10"
                                                        onClick={() => setControllingOffice(null)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="relative" ref={activeSearchTarget === "controlling" ? searchRef : null}>
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                        <Input 
                                                            type="text" 
                                                            placeholder="Search to assign controlling office..." 
                                                            value={activeSearchTarget === "controlling" ? searchQuery : ""}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            onFocus={() => {
                                                                setActiveSearchTarget("controlling");
                                                                setSearchQuery("");
                                                                setSearchResults([]);
                                                            }}
                                                            className="pl-9 py-5 rounded-xl bg-background/80" 
                                                        />
                                                    </div>
                                                    
                                                    {activeSearchTarget === "controlling" && searchQuery && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 shadow-2xl rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                                                            {searching ? (
                                                                <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                                                            ) : searchResults.length > 0 ? (
                                                                searchResults.map(result => (
                                                                    <div 
                                                                        key={result.id} 
                                                                        className="p-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center border-b border-border/30 last:border-0"
                                                                        onClick={() => handleSelectResult(result)}
                                                                    >
                                                                        <span className="font-medium text-sm">{result.name}</span>
                                                                        <Badge variant="outline" className="text-xs">{result.postalCode}</Badge>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="p-4 text-center text-sm text-muted-foreground">No offices found.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Controlled Offices Section */}
                                        <div className="pt-6">
                                            <label className="block text-sm font-bold text-amber-500 mb-2">Controlled Offices (Sub-Offices)</label>
                                            
                                            <div className="space-y-2 mb-3">
                                                {controlledOffices.length === 0 ? (
                                                    <div className="p-3 bg-background/50 border border-dashed border-border/50 rounded-xl text-sm text-muted-foreground text-center">
                                                        No sub-offices assigned.
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {controlledOffices.map(sub => (
                                                            <div key={sub.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border/50 rounded-lg text-sm">
                                                                <span className="font-medium">{sub.name}</span>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => removeControlled(sub.id)}
                                                                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative" ref={activeSearchTarget === "controlled" ? searchRef : null}>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input 
                                                        type="text" 
                                                        placeholder="Search to add sub-offices..." 
                                                        value={activeSearchTarget === "controlled" ? searchQuery : ""}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        onFocus={() => {
                                                            setActiveSearchTarget("controlled");
                                                            setSearchQuery("");
                                                            setSearchResults([]);
                                                        }}
                                                        className="pl-9 py-5 rounded-xl bg-background/80" 
                                                    />
                                                </div>
                                                
                                                {activeSearchTarget === "controlled" && searchQuery && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 shadow-2xl rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                                                        {searching ? (
                                                            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                                                        ) : searchResults.length > 0 ? (
                                                            searchResults.map(result => (
                                                                <div 
                                                                    key={result.id} 
                                                                    className="p-3 hover:bg-amber-500/10 cursor-pointer flex justify-between items-center border-b border-border/30 last:border-0"
                                                                    onClick={() => handleSelectResult(result)}
                                                                >
                                                                    <span className="font-medium text-sm">{result.name}</span>
                                                                    <Badge variant="outline" className="text-xs">{result.postalCode}</Badge>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center text-sm text-muted-foreground">No offices found.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="sticky bottom-0 left-0 right-0 pt-4 pb-2 bg-card/90 backdrop-blur-md border-t border-border/50 mt-8 flex justify-end gap-3 z-10">
                                <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl px-6">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving} className="rounded-xl px-8 shadow-lg shadow-primary/20">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
                                    {saving ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
