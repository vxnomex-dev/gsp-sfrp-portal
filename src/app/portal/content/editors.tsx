"use client";

import { useActionState } from "react";
import { Trash2, Plus } from "lucide-react";
import { deleteStaffMember, saveDivision, saveStaffMember } from "@/app/actions";
import type { FormState } from "@/lib/forms";
import { Alert, SubmitButton } from "@/components/ui";

type Member = { id: number; name: string; rank: string; title: string; bio: string; photo_url: string | null; sort_order: number };
type Division = { slug: string; name: string; summary: string; duties: string; commander: string | null; recruitment: string };

export function StaffEditor({ member }: { member?: Member }) {
  const [state, action] = useActionState<FormState, FormData>(saveStaffMember, {});
  const isNew = !member;
  return (
    <div className={`card p-5 ${isNew ? "border-dashed" : ""}`}>
      <form action={action} className="space-y-3" key={member ? JSON.stringify(member) : "new"}>
        {isNew && (
          <div className="flex items-center gap-2 font-display uppercase text-navy">
            <Plus size={16} /> Add a command staff member
          </div>
        )}
        {member && <input type="hidden" name="id" value={member.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Rank</label>
            <input name="rank" className="field" defaultValue={member?.rank} placeholder="e.g. Major" required />
          </div>
          <div>
            <label className="field-label">Name</label>
            <input name="name" className="field" defaultValue={member?.name} placeholder="First Last" required />
          </div>
          <div>
            <label className="field-label">Title</label>
            <input name="title" className="field" defaultValue={member?.title} placeholder="e.g. Deputy Commander" required />
          </div>
          <div>
            <label className="field-label">Display order</label>
            <input name="sort_order" type="number" className="field" defaultValue={member?.sort_order ?? 10} />
          </div>
        </div>
        <div>
          <label className="field-label">Bio</label>
          <textarea name="bio" className="field !min-h-20" rows={3} defaultValue={member?.bio} />
        </div>
        <div>
          <label className="field-label">Photo URL</label>
          <input name="photo_url" className="field" defaultValue={member?.photo_url ?? ""} placeholder="https://… or /images/name.png" />
        </div>
        {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
        <div className="flex items-center justify-between gap-3 pt-1">
          <SubmitButton className="btn btn-navy !py-2" pendingText="Saving…">
            {isNew ? "Add member" : "Save"}
          </SubmitButton>
        </div>
      </form>
      {member && (
        <form action={deleteStaffMember} className="mt-2 flex justify-end">
          <input type="hidden" name="id" value={member.id} />
          <DeleteButton />
        </form>
      )}
    </div>
  );
}

function DeleteButton() {
  return (
    <button
      type="submit"
      className="inline-flex items-center gap-1 text-sm text-destructive hover:underline"
      onClick={(e) => {
        if (!window.confirm("Remove this person from the command staff page?")) e.preventDefault();
      }}
    >
      <Trash2 size={14} /> Remove
    </button>
  );
}

export function DivisionEditor({ division: d }: { division: Division }) {
  const [state, action] = useActionState<FormState, FormData>(saveDivision, {});
  return (
    <form action={action} className="card space-y-3 p-5" key={JSON.stringify(d)}>
      <input type="hidden" name="slug" value={d.slug} />
      <div className="font-display text-xl uppercase text-navy-ink">{d.name}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Commander</label>
          <input name="commander" className="field" defaultValue={d.commander ?? ""} placeholder="Leave blank for Vacant" />
        </div>
        <div>
          <label className="field-label">Recruitment</label>
          <select name="recruitment" className="field" defaultValue={d.recruitment}>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Summary</label>
        <textarea name="summary" className="field !min-h-20" rows={3} defaultValue={d.summary} />
      </div>
      <div>
        <label className="field-label">Duties (one per line)</label>
        <textarea name="duties" className="field !min-h-24" rows={4} defaultValue={d.duties} />
      </div>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <SubmitButton className="btn btn-navy !py-2" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
