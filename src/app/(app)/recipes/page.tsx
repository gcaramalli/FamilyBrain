"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/family-context";
import { Sheet } from "@/components/sheet";
import type { Recipe } from "@/lib/types";

type Draft = Omit<Recipe, "id"> & { id?: string };

const emptyRecipe: Draft = {
  title: "",
  description: null,
  ingredients: [],
  steps: null,
  tags: [],
  prep_minutes: null,
  servings: null,
  source_url: null,
  favorite: false,
  kid_friendly: false,
};

export default function RecipesPage() {
  const { supabase } = useFamily();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("recipes").select("*").order("favorite", { ascending: false }).order("title");
    setRecipes((data ?? []) as Recipe[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort(), [recipes]);
  const filtered = recipes.filter((r) => {
    const hay = [r.title, r.description ?? "", ...r.ingredients, ...r.tags].join(" ").toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (!tag || r.tags.includes(tag));
  });

  function surprise() {
    const pool = filtered.length ? filtered : recipes;
    if (pool.length) setViewing(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Recipes</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={surprise} disabled={!recipes.length}>🎲 Idea</button>
          <button className="btn" onClick={() => setEditing({ ...emptyRecipe })}>+ Recipe</button>
        </div>
      </div>

      <input className="input" placeholder="Search by name, ingredient, tag…" value={q} onChange={(e) => setQ(e.target.value)} />

      {tags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {tags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${tag === t ? "border-accent bg-accent text-white" : "border-border"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="card text-center text-muted">
          <p className="text-3xl">🍲</p>
          <p className="mt-2">No recipes yet. Add the family classics first — the kids&apos; favourites, the weeknight 20-minute dinners.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <button className="card w-full text-left" onClick={() => setViewing(r)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{r.title}</span>
                  <span>{r.favorite ? "⭐" : ""}{r.kid_friendly ? "👶" : ""}</span>
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.prep_minutes && <span className="chip">⏱ {r.prep_minutes} min</span>}
                  {r.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ""}>
        {viewing && (
          <RecipeView
            recipe={viewing}
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit recipe" : "New recipe"}>
        {editing && (
          <RecipeForm
            initial={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function RecipeView({ recipe, onEdit }: { recipe: Recipe; onEdit: () => void }) {
  const { supabase } = useFamily();
  const [added, setAdded] = useState(false);

  async function addToGroceries() {
    const { data: list } = await supabase.from("lists").select("id").eq("kind", "grocery").order("position").limit(1).single();
    if (!list) return alert("Create a shopping list first.");
    await supabase.from("list_items").insert(recipe.ingredients.map((title) => ({ list_id: list.id, title, notes: `for ${recipe.title}` })));
    setAdded(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {recipe.description && <p className="text-muted">{recipe.description}</p>}
      <div className="flex flex-wrap gap-1">
        {recipe.prep_minutes && <span className="chip">⏱ {recipe.prep_minutes} min</span>}
        {recipe.servings && <span className="chip">🍽 {recipe.servings}</span>}
        {recipe.tags.map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
      {recipe.ingredients.length > 0 && (
        <div>
          <h3 className="font-semibold">Ingredients</h3>
          <ul className="mt-1 list-disc pl-5">
            {recipe.ingredients.map((i, n) => <li key={n}>{i}</li>)}
          </ul>
          <button className="btn-ghost mt-2" onClick={addToGroceries} disabled={added}>
            {added ? "✓ Added to groceries" : "🛒 Add all to groceries"}
          </button>
        </div>
      )}
      {recipe.steps && (
        <div>
          <h3 className="font-semibold">Steps</h3>
          <p className="mt-1 whitespace-pre-wrap">{recipe.steps}</p>
        </div>
      )}
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-sm text-accent underline">Original recipe</a>
      )}
      <button className="btn-ghost" onClick={onEdit}>Edit</button>
    </div>
  );
}

function RecipeForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const { supabase } = useFamily();
  const [d, setD] = useState<Draft>(initial);
  const [ingredients, setIngredients] = useState(initial.ingredients.join("\n"));
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fields = {
      title: d.title,
      description: d.description,
      steps: d.steps,
      prep_minutes: d.prep_minutes,
      servings: d.servings,
      source_url: d.source_url,
      favorite: d.favorite,
      kid_friendly: d.kid_friendly,
      ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    };
    const { error } = d.id ? await supabase.from("recipes").update(fields).eq("id", d.id) : await supabase.from("recipes").insert(fields);
    if (error) setError(error.message);
    else onDone();
  }

  async function remove() {
    if (!d.id || !confirm("Delete this recipe?")) return;
    await supabase.from("recipes").delete().eq("id", d.id);
    onDone();
  }

  const num = (v: string) => (v ? Number(v) : null);

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <input className="input" placeholder="Name" required value={d.title} onChange={(e) => set("title", e.target.value)} />
      <textarea className="input" placeholder="Short description" value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
      <div>
        <span className="label">Ingredients (one per line)</span>
        <textarea className="input min-h-28" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"400 g pasta\n2 carrots"} />
      </div>
      <div>
        <span className="label">Steps</span>
        <textarea className="input min-h-28" value={d.steps ?? ""} onChange={(e) => set("steps", e.target.value || null)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" type="number" inputMode="numeric" placeholder="Minutes" value={d.prep_minutes ?? ""} onChange={(e) => set("prep_minutes", num(e.target.value))} />
        <input className="input" type="number" inputMode="numeric" placeholder="Servings" value={d.servings ?? ""} onChange={(e) => set("servings", num(e.target.value))} />
      </div>
      <input className="input" placeholder="Tags, comma separated (vegetarian, quick, batch)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <input className="input" type="url" placeholder="Link (optional)" value={d.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.favorite} onChange={(e) => set("favorite", e.target.checked)} /> ⭐ Favourite</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.kid_friendly} onChange={(e) => set("kid_friendly", e.target.checked)} /> 👶 Kid-friendly</label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn flex-1">Save</button>
        {d.id && <button type="button" className="btn-ghost text-danger" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}
