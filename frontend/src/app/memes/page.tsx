"use client";

import { useState, useEffect, useCallback } from "react";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

const PRESETS = [
  {
    name: "Positive Fan Post",
    post_text: "I can't stop rewatching The Wayfinders. Every time I notice something new. This show is genuinely better than most big-budget fantasy series and it's not even close.",
    post_author: "u/wayfinders_obsessed",
    platform: "reddit",
  },
  {
    name: "Negative Criticism",
    post_text: "Honestly The Wayfinders season 1 was overhyped. The pacing was slow and the CGI looked cheap compared to what Disney and Netflix are doing. Not sure why everyone keeps recommending it.",
    post_author: "u/honest_tv_reviews",
    platform: "reddit",
  },
  {
    name: "Meme Post (Drake)",
    post_text: "Watching generic streaming fantasy shows vs Watching The Wayfinders for the 5th time this month",
    post_author: "u/meme_lord_tv",
    platform: "reddit",
    meme_template: "Drake Hotline Bling",
  },
  {
    name: "YouTube Comment",
    post_text: "This scene made me cry actual tears. The way they animated Zaya's face when she realizes what she has to do... Angel Studios doesn't get enough credit for what they've done here.",
    post_author: "AnimationFanatic",
    platform: "youtube",
  },
];

/* ── Lightbox Modal ── */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
      onClick={onClose}>
      <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--card)] border border-[var(--border)] rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors text-sm">
          &#10005;
        </button>
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
      </div>
    </div>
  );
}

export default function MemeLabPage() {
  const [customPost, setCustomPost] = useState("");
  const [customAuthor, setCustomAuthor] = useState("u/test_user");
  const [customPlatform, setCustomPlatform] = useState("reddit");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedText, setSelectedText] = useState<number | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<Record<number, number>>({});
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [compositing, setCompositing] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (post: any) => {
    setLoading(true);
    setResult(null);
    setCurrentStep(0);
    setSelectedText(null);
    setSelectedScenes({});
    setApproved(false);
    setCompositeUrl(null);
    setError(null);
    try {
      const resp = await fetch("/api/simulate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_text: post.post_text || customPost,
          post_author: post.post_author || customAuthor,
          platform: post.platform || customPlatform,
          meme_template: post.meme_template || null,
          property_name: "The Wayfinders",
          show_id: 7,
        }),
      });
      if (!resp.ok) throw new Error("Pipeline failed");
      const data = await resp.json();
      setResult(data);
      for (let i = 0; i < data.steps.length; i++) {
        await new Promise((r) => setTimeout(r, 600));
        setCurrentStep(i + 1);
      }
    } catch (e: any) {
      setError(e.message || "Pipeline failed");
    } finally {
      setLoading(false);
    }
  };

  /* Generate composite image when text + scenes are both selected */
  const generateComposite = useCallback(async () => {
    if (!result || selectedText === null) return;

    const panels = result.steps[4]?.data?.panels;
    if (!panels || panels.length < 2) return;

    const scene1 = panels[0]?.matches?.[selectedScenes[1] || 0];
    const scene2 = panels[1]?.matches?.[selectedScenes[2] || 0];
    if (!scene1?.scene_id || !scene2?.scene_id) return;

    const textOpt = result.steps[5]?.data?.options?.[selectedText];
    if (!textOpt) return;

    setCompositing(true);
    try {
      const resp = await fetch("/api/simulate/composite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene_ids: [scene1.scene_id, scene2.scene_id],
          top_text: textOpt.top_text,
          bottom_text: textOpt.bottom_text,
          layout: "top_bottom",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setCompositeUrl(data.image_url);
      }
    } catch (e) {
      console.error("Composite generation failed:", e);
    } finally {
      setCompositing(false);
    }
  }, [result, selectedText, selectedScenes]);

  useEffect(() => {
    if (selectedText !== null && result) {
      generateComposite();
    }
  }, [selectedText, selectedScenes, generateComposite]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} alt="Preview" onClose={() => setLightboxSrc(null)} />}

      <div>
        <h1 className="text-2xl font-bold">Meme Lab</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Simulate the full pipeline: detect &rarr; analyze &rarr; identify &rarr; match scenes &rarr; generate &rarr; approve
        </p>
      </div>

      {/* Error toast */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&#10005;</button>
        </div>
      )}

      {/* Preset posts */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Quick Test &mdash; Preset Posts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => runSimulation(preset)}
              disabled={loading}
              className="text-left p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-medium">{preset.name}</div>
              <div className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{preset.post_text}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  backgroundColor: `${PLATFORM_COLORS[preset.platform] || "#6B7280"}20`,
                  color: PLATFORM_COLORS[preset.platform] || "#6B7280",
                }}>{preset.platform}</span>
                <span className="text-[10px] text-[var(--muted)]">{preset.post_author}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom post */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Custom Post</h3>
        <textarea
          value={customPost}
          onChange={(e) => setCustomPost(e.target.value)}
          placeholder="Paste or write a post mentioning The Wayfinders..."
          rows={3}
          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
        />
        <div className="flex gap-2 mt-2">
          <input value={customAuthor} onChange={(e) => setCustomAuthor(e.target.value)}
            className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm w-40" />
          <select value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)}
            className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm">
            <option value="reddit">Reddit</option>
            <option value="youtube">YouTube</option>
            <option value="twitter">X/Twitter</option>
            <option value="instagram">Instagram</option>
          </select>
          <button onClick={() => runSimulation({ post_text: customPost, post_author: customAuthor, platform: customPlatform })}
            disabled={loading || !customPost.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Running Pipeline..." : "Run Simulation"}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !result && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Pipeline Results</h2>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-24 bg-[var(--border)] rounded mb-3" />
              <div className="h-3 w-64 bg-[var(--border)] rounded mb-2" />
              <div className="h-12 bg-[var(--border)] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Steps */}
      {result && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Pipeline Results</h2>

          {result.steps.map((step: any, i: number) => {
            const visible = i < currentStep;
            if (!visible) return null;

            return (
              <div key={i} className="card border-l-4 animate-in" style={{
                borderLeftColor: step.step === 7 ? "#22C55E" : step.step <= 3 ? "#3b82f6" : step.step <= 5 ? "#a855f7" : "#EAB308",
                animation: "fadeSlideIn 0.3s ease-out",
              }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--bg)]">
                    Step {step.step}
                  </span>
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                <p className="text-sm text-[var(--muted)] mb-3">{step.description}</p>

                {/* Step 1: Post */}
                {step.step === 1 && (
                  <div className="bg-[var(--bg)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="px-2 py-0.5 rounded text-xs" style={{
                        backgroundColor: `${PLATFORM_COLORS[step.data.platform] || "#6B7280"}20`,
                        color: PLATFORM_COLORS[step.data.platform] || "#6B7280",
                      }}>{step.data.platform}</span>
                      <span className="font-medium">{step.data.author}</span>
                    </div>
                    <p className="text-sm">{step.data.content}</p>
                  </div>
                )}

                {/* Step 2: Sentiment */}
                {step.step === 2 && (
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold" style={{
                      color: SENTIMENT_COLORS[step.data.label as keyof typeof SENTIMENT_COLORS] || "#6B7280"
                    }}>
                      {step.data.score > 0 ? "+" : ""}{step.data.score.toFixed(2)}
                    </span>
                    <span className="text-sm capitalize px-3 py-1 rounded-full" style={{
                      backgroundColor: `${SENTIMENT_COLORS[step.data.label as keyof typeof SENTIMENT_COLORS] || "#6B7280"}20`,
                      color: SENTIMENT_COLORS[step.data.label as keyof typeof SENTIMENT_COLORS] || "#6B7280",
                    }}>{step.data.label}</span>
                    {step.data.detail && (
                      <div className="text-xs text-[var(--muted)]">
                        +{(step.data.detail.positive * 100).toFixed(0)}% / -{(step.data.detail.negative * 100).toFixed(0)}% / ~{(step.data.detail.neutral * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Entities */}
                {step.step === 3 && step.data.entities?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {step.data.entities.map((ent: any, j: number) => (
                      <span key={j} className="text-xs px-2 py-1 bg-purple-500/10 text-purple-400 rounded">
                        {ent.name} ({ent.type})
                      </span>
                    ))}
                  </div>
                )}

                {/* Step 4: Meme Identified */}
                {step.step === 4 && (
                  <div className="bg-[var(--bg)] rounded-lg p-3 space-y-3">
                    <div className="flex gap-4">
                      {step.data.template_image_url && (
                        <img src={step.data.template_image_url} alt="Meme template"
                          className="w-32 h-32 object-contain rounded border border-[var(--border)] cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxSrc(step.data.template_image_url)} />
                      )}
                      <div className="space-y-2 flex-1">
                        <div className="flex gap-6 flex-wrap">
                          <div><span className="text-xs text-[var(--muted)]">Response Template</span>
                            <div className="text-sm font-medium text-blue-400">{step.data.best_response_template || step.data.original_template}</div></div>
                          <div><span className="text-xs text-[var(--muted)]">Humor Type</span>
                            <div className="text-sm capitalize">{step.data.humor_type}</div></div>
                          <div><span className="text-xs text-[var(--muted)]">Target Sentiment</span>
                            <div className="text-sm capitalize">{step.data.target_sentiment}</div></div>
                        </div>
                        {step.data.response_angle && (
                          <div><span className="text-xs text-[var(--muted)]">Response Angle</span>
                            <div className="text-sm italic">{step.data.response_angle}</div></div>
                        )}
                        {step.data.meme_description && (
                          <div><span className="text-xs text-[var(--muted)]">Meme Context</span>
                            <div className="text-sm">{step.data.meme_description}</div></div>
                        )}
                        <div className="flex gap-3 pt-1">
                          {step.data.explanation_url && (
                            <a href={step.data.explanation_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline">Meme Explanation &rarr;</a>
                          )}
                          {step.data.knowyourmeme_url && (
                            <a href={step.data.knowyourmeme_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline">Know Your Meme &rarr;</a>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Original triggering post reminder */}
                    {result.steps[0]?.data && (
                      <div className="border-t border-[var(--border)] pt-2 mt-2">
                        <div className="text-[10px] text-[var(--muted)] mb-1">ORIGINAL POST THAT TRIGGERED THIS</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded" style={{
                            backgroundColor: `${PLATFORM_COLORS[result.steps[0].data.platform] || "#6B7280"}20`,
                            color: PLATFORM_COLORS[result.steps[0].data.platform] || "#6B7280",
                          }}>{result.steps[0].data.platform}</span>
                          <span className="font-medium">{result.steps[0].data.author}</span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1 italic line-clamp-2">{result.steps[0].data.content}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Scenes */}
                {step.step === 5 && (
                  <div className="space-y-4">
                    {step.data.panels?.map((panel: any) => (
                      <div key={panel.panel} className="bg-[var(--bg)] rounded-lg p-3">
                        <div className="text-xs text-[var(--muted)] mb-2">
                          Panel {panel.panel}: <span className="text-blue-400">{panel.query}</span>
                        </div>
                        {panel.matches?.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {panel.matches.map((scene: any, j: number) => (
                              <button key={j}
                                onClick={() => setSelectedScenes(s => ({ ...s, [panel.panel]: j }))}
                                className={`text-left p-2 rounded border transition-all ${
                                  selectedScenes[panel.panel] === j
                                    ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                                    : "border-[var(--border)] hover:border-blue-500/50"
                                }`}>
                                {scene.thumbnail_url && (
                                  <div className="relative group">
                                    <img src={scene.thumbnail_url} alt={`Scene ${scene.scene_id}`}
                                      className="w-full h-24 object-cover rounded mb-1"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setLightboxSrc(scene.thumbnail_url); }}
                                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                      &#x26F6;
                                    </button>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-medium">Scene {scene.scene_id}</div>
                                  <div className="text-[10px] text-blue-400">{(scene.similarity * 100).toFixed(1)}%</div>
                                </div>
                                <div className="text-[10px] text-[var(--muted)] mt-1 line-clamp-2">{scene.description}</div>
                                {scene.mood && <div className="text-[10px] text-purple-400 mt-1">{scene.mood}</div>}
                                {scene.episode && <div className="text-[10px] text-[var(--muted)]">{scene.episode}</div>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-red-400">No matching scenes found for this panel</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 6: Text Options */}
                {step.step === 6 && (
                  <div className="space-y-2">
                    {step.data.options?.map((opt: any, j: number) => (
                      <button key={j}
                        onClick={() => setSelectedText(j)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedText === j
                            ? "border-green-500 bg-green-500/10 ring-1 ring-green-500/30"
                            : "border-[var(--border)] hover:border-green-500/50"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded capitalize">{opt.tone}</span>
                          {selectedText === j && <span className="text-xs text-green-400 font-medium">Selected</span>}
                        </div>
                        <div className="text-sm font-medium">{opt.top_text}</div>
                        <div className="text-sm font-medium mt-1">{opt.bottom_text}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 7: Preview & Approve */}
                {step.step === 7 && (
                  <div className="space-y-4">
                    {/* Meme Preview — composited image or fallback */}
                    {selectedText !== null && result.steps[5]?.data?.options?.[selectedText] && (
                      <div className="bg-[var(--bg)] rounded-lg p-4">
                        <div className="text-xs text-[var(--muted)] mb-3">MEME PREVIEW</div>
                        <div className="max-w-md mx-auto">
                          {compositing && (
                            <div className="flex items-center justify-center h-48 bg-[var(--card)] rounded-lg">
                              <div className="text-sm text-[var(--muted)] animate-pulse">Generating meme image...</div>
                            </div>
                          )}
                          {compositeUrl && !compositing && (
                            <img
                              src={compositeUrl}
                              alt="Generated meme"
                              className="w-full rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxSrc(compositeUrl)}
                            />
                          )}
                          {!compositeUrl && !compositing && (
                            /* Fallback: show scene thumbnails with text overlay */
                            <div className="space-y-1">
                              {[0, 1].map((panelIdx) => {
                                const panel = result.steps[4]?.data?.panels?.[panelIdx];
                                const sceneIdx = selectedScenes[panelIdx + 1] || 0;
                                const scene = panel?.matches?.[sceneIdx];
                                const textLine = panelIdx === 0
                                  ? result.steps[5].data.options[selectedText].top_text
                                  : result.steps[5].data.options[selectedText].bottom_text;

                                return (
                                  <div key={panelIdx} className="relative">
                                    {scene?.thumbnail_url ? (
                                      <img src={scene.thumbnail_url} alt={`Panel ${panelIdx + 1}`}
                                        className="w-full h-48 object-cover rounded"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                        }}
                                      />
                                    ) : null}
                                    <div className={`${scene?.thumbnail_url ? "hidden" : ""} w-full h-48 bg-gray-800 rounded flex items-center justify-center`}>
                                      <span className="text-xs text-[var(--muted)]">[Scene from Wayfinders]</span>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center p-4">
                                      <div className="text-center font-bold text-white text-lg uppercase"
                                        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)" }}>
                                        {textLine}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="text-center mt-3 text-xs text-[var(--muted)]">
                            Template: {result.summary?.template} | Voice: {result.steps[5].data.options[selectedText].tone}
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedText === null && (
                      <div className="text-sm text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                        Select text from Step 6 above to see meme preview
                      </div>
                    )}

                    {/* Action buttons */}
                    {!approved ? (
                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={async () => {
                            if (selectedText === null) return;
                            setApproving(true);
                            try {
                              const textOpt = result.steps[5].data.options[selectedText];
                              const resp = await fetch("/api/memes/generate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  template_id: "demo",
                                  top_text: textOpt.top_text,
                                  bottom_text: textOpt.bottom_text,
                                  topic_id: null,
                                  target_platforms: ["reddit", "youtube"],
                                }),
                              });
                              if (!resp.ok) throw new Error("Failed to queue");
                              setApproved(true);
                            } catch (e: any) {
                              setError(e.message || "Failed to queue meme");
                            } finally {
                              setApproving(false);
                            }
                          }}
                          disabled={selectedText === null || approving}
                          className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 transition-colors">
                          {approving ? "Queuing..." : "Approve & Queue for Posting"}
                        </button>
                        <button
                          onClick={() => { setResult(null); setCurrentStep(0); setCompositeUrl(null); }}
                          className="px-6 py-2.5 bg-red-600/80 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                          Reject
                        </button>
                        <button
                          onClick={() => generateComposite()}
                          disabled={selectedText === null || compositing}
                          className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-sm rounded-lg hover:border-purple-500 disabled:opacity-50 transition-colors">
                          {compositing ? "Generating..." : "Regenerate Image"}
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-green-400 font-medium">
                          <span className="text-lg">&#10003;</span> Meme approved and queued for posting
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          Will be posted via WayfinderNerd to Reddit and YouTube.{" "}
                          <a href="/queue" className="text-blue-400 hover:underline">View Queue &rarr;</a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Step progress indicator while loading */}
          {loading && currentStep < (result?.steps?.length || 7) && (
            <div className="card animate-pulse border-l-4 border-l-[var(--border)]">
              <div className="h-4 w-32 bg-[var(--border)] rounded mb-2" />
              <div className="h-3 w-48 bg-[var(--border)] rounded" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
