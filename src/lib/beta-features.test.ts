import test from "node:test";
import assert from "node:assert/strict";
import {
    canUserSelfToggleMailRouting,
    computeMailRoutingAccess,
} from "./beta-features";

test("computeMailRoutingAccess denies public visitors and defaults off for logged-in users", () => {
    assert.equal(
        computeMailRoutingAccess({
            isAuthenticated: false,
            betaAvailable: true,
            userEnabled: true,
        }),
        false
    );
    assert.equal(
        computeMailRoutingAccess({
            isAuthenticated: true,
            betaAvailable: true,
            userEnabled: false,
        }),
        false
    );
    assert.equal(
        computeMailRoutingAccess({
            isAuthenticated: true,
            betaAvailable: false,
            userEnabled: true,
        }),
        false
    );
    assert.equal(
        computeMailRoutingAccess({
            isAuthenticated: true,
            betaAvailable: true,
            userEnabled: true,
        }),
        true
    );
});

test("canUserSelfToggleMailRouting enforces global kill switch and invite-only self-opt-in policy", () => {
    assert.deepEqual(
        canUserSelfToggleMailRouting({
            role: "CONTRIBUTOR",
            betaAvailable: true,
            selfOptInAllowed: true,
            nextEnabled: true,
        }),
        { ok: true }
    );

    // Turning off is always permitted even when paused or invite-only
    assert.deepEqual(
        canUserSelfToggleMailRouting({
            role: "CONTRIBUTOR",
            betaAvailable: false,
            selfOptInAllowed: false,
            nextEnabled: false,
        }),
        { ok: true }
    );

    const paused = canUserSelfToggleMailRouting({
        role: "SUPER_ADMIN",
        betaAvailable: false,
        selfOptInAllowed: true,
        nextEnabled: true,
    });
    assert.equal(paused.ok, false);

    const inviteOnlyContributor = canUserSelfToggleMailRouting({
        role: "CONTRIBUTOR",
        betaAvailable: true,
        selfOptInAllowed: false,
        nextEnabled: true,
    });
    assert.equal(inviteOnlyContributor.ok, false);

    const inviteOnlyAdmin = canUserSelfToggleMailRouting({
        role: "SUPER_ADMIN",
        betaAvailable: true,
        selfOptInAllowed: false,
        nextEnabled: true,
    });
    assert.deepEqual(inviteOnlyAdmin, { ok: true });
});
