import { Check, MessageSquare, Pencil, Send, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Database, Tables } from "../types/database.types";

type CommentRow = Tables<"v_comments_with_author">;
type CommentInsert = Database["public"]["Tables"]["comments"]["Insert"];
type CommentTargetType = "race" | "leg" | "leg_instance" | "runner";

type CommentsSectionProps = {
  className?: string;
  legNumber?: number | null;
  legVersion?: number | null;
  runnerId?: string | null;
  targetType: CommentTargetType;
  title?: string;
  year?: number | null;
};

const CommentsSection: React.FC<CommentsSectionProps> = ({
  className = "",
  legNumber = null,
  legVersion = null,
  runnerId = null,
  targetType,
  title = "Comments",
  year = null,
}) => {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const targetReady = useMemo(
    () => isTargetReady(targetType, year, legNumber, legVersion, runnerId),
    [legNumber, legVersion, runnerId, targetType, year]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        setCurrentUserId(user?.id ?? null);
      }

      if (!targetReady) {
        if (!cancelled) {
          setComments([]);
          setLoading(false);
        }
        return;
      }

      try {
        let query = supabase
          .from("v_comments_with_author")
          .select("*")
          .eq("target_type", targetType);

        if (targetType === "race") {
          query = query
            .eq("year", year as number)
            .is("leg_number", null)
            .is("leg_version", null)
            .is("runner_id", null);
        } else if (targetType === "leg") {
          query = query
            .is("year", null)
            .eq("leg_number", legNumber as number)
            .eq("leg_version", legVersion as number)
            .is("runner_id", null);
        } else if (targetType === "leg_instance") {
          query = query
            .eq("year", year as number)
            .eq("leg_number", legNumber as number)
            .eq("leg_version", legVersion as number)
            .eq("runner_id", runnerId as string);
        } else {
          query = query
            .is("year", null)
            .is("leg_number", null)
            .is("leg_version", null)
            .eq("runner_id", runnerId as string);
        }

        const { data, error: loadError } = await query.order("created_at", { ascending: false });

        if (loadError) {
          throw loadError;
        }

        if (!cancelled) {
          setComments(data ?? []);
        }
      } catch (loadErr) {
        if (!cancelled) {
          setError(loadErr instanceof Error ? loadErr.message : "Could not load comments.");
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [legNumber, legVersion, runnerId, targetReady, targetType, year]);

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();

    if (!body || !targetReady) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: CommentInsert = buildCommentPayload({
        body,
        legNumber,
        legVersion,
        runnerId,
        targetType,
        year,
      });
      const { data: inserted, error: insertError } = await supabase
        .from("comments")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const { data: savedComment, error: viewError } = await supabase
        .from("v_comments_with_author")
        .select("*")
        .eq("id", inserted.id)
        .single();

      if (viewError) {
        throw viewError;
      }

      setComments((current) => [savedComment, ...current]);
      setDraft("");
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : "Could not save comment.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (comment: CommentRow) => {
    setEditingId(comment.id);
    setEditingBody(comment.body || "");
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingBody("");
  };

  const handleUpdateComment = async (commentId: string) => {
    const body = editingBody.trim();

    if (!body) {
      setError("Comment cannot be empty.");
      return;
    }

    setMutatingId(commentId);
    setError("");

    try {
      const { data: updated, error: updateError } = await supabase
        .from("comments")
        .update({ body })
        .eq("id", commentId)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      const { data: savedComment, error: viewError } = await supabase
        .from("v_comments_with_author")
        .select("*")
        .eq("id", updated.id)
        .single();

      if (viewError) {
        throw viewError;
      }

      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? savedComment : comment))
      );
      handleCancelEdit();
    } catch (updateErr) {
      setError(updateErr instanceof Error ? updateErr.message : "Could not update comment.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) {
      return;
    }

    setMutatingId(commentId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) {
        throw deleteError;
      }

      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : "Could not delete comment.");
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <section className={`card p-6 ${className}`}>
      <div className="mb-5 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      <form onSubmit={handleAddComment} className="mb-5 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={!targetReady || saving}
          placeholder="Add a comment"
          className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!draft.trim() || !targetReady || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Send className="h-4 w-4" />
            <span>{saving ? "Saving..." : "Comment"}</span>
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </form>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-600">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const commentId = comment.id;
            const canEdit = Boolean(commentId) && (!comment.author_id || comment.author_id === currentUserId);
            const isEditing = editingId === commentId;

            return (
              <article
                key={commentId ?? `${comment.target_type}-${comment.created_at}`}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {comment.author_runner_name || "Signed-in user"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatCommentDate(comment.created_at)}
                      {comment.updated_at !== comment.created_at && " • edited"}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => commentId && handleUpdateComment(commentId)}
                            disabled={!commentId || mutatingId === commentId}
                            className="rounded-lg p-2 text-green-700 transition-colors hover:bg-green-50 disabled:text-gray-400"
                            aria-label="Save comment"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                            aria-label="Cancel edit"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(comment)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                            aria-label="Edit comment"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => commentId && handleDeleteComment(commentId)}
                            disabled={!commentId || mutatingId === commentId}
                            className="rounded-lg p-2 text-red-700 transition-colors hover:bg-red-50 disabled:text-gray-400"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    value={editingBody}
                    onChange={(event) => setEditingBody(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

function buildCommentPayload({
  body,
  legNumber,
  legVersion,
  runnerId,
  targetType,
  year,
}: {
  body: string;
  legNumber: number | null;
  legVersion: number | null;
  runnerId: string | null;
  targetType: CommentTargetType;
  year: number | null;
}): CommentInsert {
  if (targetType === "race") {
    return {
      body,
      leg_number: null,
      leg_version: null,
      runner_id: null,
      target_type: targetType,
      year,
    };
  }

  if (targetType === "leg") {
    return {
      body,
      leg_number: legNumber,
      leg_version: legVersion,
      runner_id: null,
      target_type: targetType,
      year: null,
    };
  }

  if (targetType === "leg_instance") {
    return {
      body,
      leg_number: legNumber,
      leg_version: legVersion,
      runner_id: runnerId,
      target_type: targetType,
      year,
    };
  }

  return {
    body,
    leg_number: null,
    leg_version: null,
    runner_id: runnerId,
    target_type: targetType,
    year: null,
  };
}

function isTargetReady(
  targetType: CommentTargetType,
  year: number | null,
  legNumber: number | null,
  legVersion: number | null,
  runnerId: string | null
) {
  if (targetType === "race") {
    return typeof year === "number" && Number.isFinite(year);
  }

  if (targetType === "leg") {
    return (
      typeof legNumber === "number" &&
      Number.isFinite(legNumber) &&
      typeof legVersion === "number" &&
      Number.isFinite(legVersion)
    );
  }

  if (targetType === "leg_instance") {
    return (
      typeof year === "number" &&
      Number.isFinite(year) &&
      typeof legNumber === "number" &&
      Number.isFinite(legNumber) &&
      typeof legVersion === "number" &&
      Number.isFinite(legVersion) &&
      Boolean(runnerId)
    );
  }

  return Boolean(runnerId);
}

function formatCommentDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default CommentsSection;
