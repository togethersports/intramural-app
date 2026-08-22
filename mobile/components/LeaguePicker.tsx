/**
 * The league switcher.
 *
 * Only appears when you are in more than one — a picker offering one choice
 * is furniture. Tapping the header opens it; picking sets the shared active
 * league, which Home, Schedule and League all read.
 */
import { Modal, Pressable, Text, View } from "react-native";
import { setActiveLeague } from "@/lib/active-league";
import { color, radius, space, type } from "@/theme";

export interface PickableLeague {
  id: string;
  name: string;
  role?: string;
}

export function LeaguePicker({
  open,
  leagues,
  activeId,
  onClose,
}: {
  open: boolean;
  leagues: PickableLeague[];
  activeId: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          padding: space(3),
        }}
      >
        {/* Stops a tap inside the card from closing it. */}
        <Pressable
          onPress={() => {}}
          style={{
            borderRadius: radius.card,
            // Genuinely opaque. Both paper and bench are translucent glass —
            // right for a card resting on the canvas, wrong for a sheet
            // floating over one, which showed the page straight through the
            // list and made two screens fight for the same pixels.
            backgroundColor: color.canvas,
            borderWidth: 1,
            borderColor: color.glassBorder,
            overflow: "hidden",
          }}
        >
          <Text
            style={[
              type.small,
              {
                color: color.inkFaint,
                paddingHorizontal: space(2),
                paddingTop: space(2),
                paddingBottom: space(1),
              },
            ]}
          >
            Switch league
          </Text>
          {leagues.map((l) => {
            const active = l.id === activeId;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  setActiveLeague(l.id);
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space(1.5),
                  paddingHorizontal: space(2),
                  paddingVertical: space(1.75),
                  backgroundColor: active ? color.tint : "transparent",
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.bodyMedium,
                      { color: active ? color.accent : color.ink },
                    ]}
                  >
                    {l.name}
                  </Text>
                  {l.role ? (
                    <Text style={[type.small, { color: color.inkFaint }]}>
                      {l.role}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: color.accent,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
