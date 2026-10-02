"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/*
 * Names for the breadcrumb trail. The trail is built from the address, which
 * only has ids; a detail page knows who an id is and says so with
 * `<CrumbName id={patient.id} name="Ramon Dela Cruz" />`.
 */
type Names = Record<string, string>;
const Ctx = createContext<{ names: Names; set: (id: string, name: string) => void }>({ names: {}, set: () => {} });

export function CrumbNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<Names>({});
  return (
    <Ctx.Provider value={{ names, set: (id, name) => setNames((n) => (n[id] === name ? n : { ...n, [id]: name })) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCrumbNames() {
  return useContext(Ctx).names;
}

/** Renders nothing: tells the trail what to call this id. */
export function CrumbName({ id, name }: { id: string; name: string }) {
  const { set } = useContext(Ctx);
  useEffect(() => set(id, name), [id, name, set]);
  return null;
}
