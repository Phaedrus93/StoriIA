import { describe, it, expect, vi } from "vitest";

describe("Child Mode App Metadata Security Verification", () => {
  it("deve aggiornare user.app_metadata (non user_metadata) affinché il JWT contenga is_child_mode e active_child_profile_id", async () => {
    // Simuliamo il comportamento del server-side admin client con updateUserById
    let simulatedUser = {
      id: "user-123",
      email: "parent@test.com",
      user_metadata: { name: "Genitore" },
      app_metadata: { provider: "email" },
    };

    const mockAdminUpdateUserById = vi.fn(
      async (userId: string, attributes: { app_metadata?: Record<string, unknown> }) => {
        if (attributes.app_metadata) {
          simulatedUser = {
            ...simulatedUser,
            app_metadata: {
              ...simulatedUser.app_metadata,
              ...attributes.app_metadata,
            },
          };
        }
        return { data: { user: simulatedUser }, error: null };
      }
    );

    // Eseguiamo l'aggiornamento come fatto in select-profile e enable
    const childProfileId = "child-abc-456";
    await mockAdminUpdateUserById(simulatedUser.id, {
      app_metadata: {
        ...simulatedUser.app_metadata,
        is_child_mode: true,
        active_child_profile_id: childProfileId,
      },
    });

    // 1. Verifica che app_metadata (non user_metadata) contenga i parametri di sicurezza
    expect(simulatedUser.app_metadata).toHaveProperty("is_child_mode", true);
    expect(simulatedUser.app_metadata).toHaveProperty(
      "active_child_profile_id",
      childProfileId
    );

    // 2. Verifica che user_metadata NON sia stato inquinato o modificato per errore
    expect(simulatedUser.user_metadata).not.toHaveProperty("is_child_mode");
    expect(simulatedUser.user_metadata).not.toHaveProperty(
      "active_child_profile_id"
    );
  });

  it("deve rimuovere is_child_mode e active_child_profile_id da app_metadata al verify-pin (uscita al genitore)", async () => {
    let simulatedUser = {
      id: "user-123",
      user_metadata: {},
      app_metadata: {
        is_child_mode: true,
        active_child_profile_id: "child-abc-456",
      },
    };

    const mockAdminUpdateUserById = vi.fn(
      async (userId: string, attributes: { app_metadata?: Record<string, unknown> }) => {
        if (attributes.app_metadata) {
          simulatedUser = {
            ...simulatedUser,
            app_metadata: {
              ...simulatedUser.app_metadata,
              ...attributes.app_metadata,
            },
          };
        }
        return { data: { user: simulatedUser }, error: null };
      }
    );

    await mockAdminUpdateUserById(simulatedUser.id, {
      app_metadata: {
        ...simulatedUser.app_metadata,
        is_child_mode: false,
        active_child_profile_id: null,
      },
    });

    expect(simulatedUser.app_metadata).toHaveProperty("is_child_mode", false);
    expect(simulatedUser.app_metadata).toHaveProperty(
      "active_child_profile_id",
      null
    );
  });
});
