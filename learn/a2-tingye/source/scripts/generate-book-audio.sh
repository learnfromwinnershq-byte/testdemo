#!/bin/zsh
set -euo pipefail

project_dir=${0:A:h:h}
book_json="$project_dir/public/books/white-paper/book.json"
output_dir="$project_dir/public/books/white-paper/audio"
build_dir="$project_dir/.book-build"
writer="$build_dir/speech-writer"

mkdir -p "$output_dir" "$build_dir"

if [[ ! -x "$writer" || "$project_dir/scripts/speech-writer.m" -nt "$writer" ]]; then
  xcrun clang -fobjc-arc -framework Foundation -framework AVFoundation \
    "$project_dir/scripts/speech-writer.m" -o "$writer"
fi

chapter_ids=(intro case-01 case-02 case-03 case-04 case-05 case-06 case-07 case-08 case-09 case-10 outro)
max_parallel=4

generate_chapter() {
  local chapter_id=$1
  mp3="$output_dir/$chapter_id.mp3"
  if [[ -s "$mp3" && -s "$output_dir/$chapter_id.cues.json" ]]; then
    echo "$chapter_id already complete"
    return
  fi

  "$writer" "$book_json" "$chapter_id" "$build_dir"
  ffmpeg -y -loglevel error -i "$build_dir/$chapter_id.caf" -ar 24000 -ac 1 -b:a 64k "$mp3"
  mv "$build_dir/$chapter_id.cues.json" "$output_dir/$chapter_id.cues.json"
  rm "$build_dir/$chapter_id.caf"
  echo "$chapter_id complete"
}

running=0
for chapter_id in $chapter_ids; do
  generate_chapter "$chapter_id" &
  (( running += 1 ))
  if (( running >= max_parallel )); then
    wait
    running=0
  fi
done
wait

# Keep a lightweight duration index so the UI can show exact chapter lengths
# without downloading every sentence timeline up front.
jq -s '{chapters: map({key:.chapterId,value:{durationMs:.durationMs,sentenceCount:(.cues|length)}})|from_entries}' \
  "$output_dir"/*.cues.json > "$build_dir/manifest.json"
mv "$build_dir/manifest.json" "$output_dir/manifest.json"
echo "all chapters complete"
