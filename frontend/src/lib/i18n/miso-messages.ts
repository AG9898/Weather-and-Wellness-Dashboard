/**
 * Misokinesia participant-facing string catalogue.
 *
 * Transcribed from `docs/labs/weather-wellness/misokinesia/LOCALIZATION.md`
 * sections 5 (instrument strings) and 6 (UI chrome strings). That document is
 * canonical: correct a label there and here together, and never change a key.
 *
 * One RA-facing block lives here too: the `ra.launch.*` keys of section 6.13,
 * which localize the `/misokinesia` launch page so the RA can see which
 * language version they are about to run. No other RA surface is translated.
 *
 * Keys here are dotted and **display-only** — they are never stored. Stored
 * values are the option keys in `miso-option-labels.ts` (LOCALIZATION.md
 * section 2), which are a separate namespace.
 *
 * Typing contract: English is the shape of record. `MisoMessageKey` is derived
 * from the EN catalogue and the KO catalogue is typed as a total
 * `Record<MisoMessageKey, string>`, so a key missing from — or added only to —
 * the KO side is a compile error. That is what keeps KO from silently falling
 * back to English.
 *
 * Placeholders use `{name}`. The KO form may reorder placeholders but must use
 * the same set; `misoMessage` interpolates them.
 */

import { type MisoLocale } from "./miso-locale";

const MISO_MESSAGES_EN = {
  // --- 5.1 VMA per-clip questionnaire ------------------------------------
  "vma.item.q1": "I find this video unpleasant",
  "vma.item.q2": "I felt physical discomfort during the video",
  "vma.item.q3": "I felt upset during the video",
  "vma.item.q4": "I wanted to stop the video early / or close my eyes",
  "vma.scale.1": "Strongly Disagree",
  "vma.scale.2": "Disagree",
  "vma.scale.3": "Neutral",
  "vma.scale.4": "Agree",
  "vma.scale.5": "Strongly Agree",

  // --- 5.2 MkAQ ----------------------------------------------------------
  "mkaq.item.q1": "My visual issues currently make me unhappy.",
  "mkaq.item.q2": "My visual issues currently create problems for me.",
  "mkaq.item.q3": "My visual issues have recently made me feel angry.",
  "mkaq.item.q4":
    "I feel that no one understands my problems with certain visuals.",
  "mkaq.item.q5": "My visual issues do not seem to have a known cause.",
  "mkaq.item.q6": "My visual issues currently make me feel helpless.",
  "mkaq.item.q7": "My visual issues currently interfere with my social life.",
  "mkaq.item.q8": "My visual issues currently make me feel isolated.",
  "mkaq.item.q9":
    "My visual issues have recently created problems for me in groups.",
  "mkaq.item.q10":
    "My visual issues negatively affect my work/school life (currently or recently).",
  "mkaq.item.q11": "My visual issues currently make me feel frustrated.",
  "mkaq.item.q12": "My visual issues currently impact my entire life negatively.",
  "mkaq.item.q13": "My visual issues have recently made me feel guilty.",
  // Curly quotes are the live EN wording; the MAQ twin uses straight quotes.
  // Cosmetic only — do not "unify" either string.
  "mkaq.item.q14": "My visual issues are classified as ‘crazy’.",
  "mkaq.item.q15": "I feel that no one can help me with my visual issues.",
  "mkaq.item.q16": "My visual issues currently make me feel hopeless.",
  "mkaq.item.q17": "I feel that my visual issues will only get worse with time.",
  "mkaq.item.q18": "My visual issues currently impact my family relationships.",
  "mkaq.item.q19":
    "My visual issues have recently affected my ability to be with other people.",
  "mkaq.item.q20": "My visual issues have not been recognized as legitimate.",
  "mkaq.item.q21":
    "I am worried that my whole life will be affected by visual issues.",
  "mkaq.scale.0": "Not at all",
  "mkaq.scale.1": "A little of the time",
  "mkaq.scale.2": "A good deal of the time",
  "mkaq.scale.3": "Almost all the time",

  // --- 5.3 GAD-7 ---------------------------------------------------------
  // The KO side is the validated Korean GAD-7, not a new translation. Never
  // reword a `gad7.*` KO string: doing so invalidates the instrument.
  "gad7.stem":
    "Over the last two weeks, how often have you been bothered by the following problems?",
  "gad7.item.r1": "Feeling nervous, anxious, or on edge",
  "gad7.item.r2": "Not being able to stop or control worrying",
  "gad7.item.r3": "Worrying too much about different things",
  "gad7.item.r4": "Trouble relaxing",
  "gad7.item.r5": "Being so restless that it is hard to sit still",
  "gad7.item.r6": "Becoming easily annoyed or irritable",
  "gad7.item.r7": "Feeling afraid, as if something awful might happen",
  "gad7.scale.0": "Not at all",
  "gad7.scale.1": "Several days",
  "gad7.scale.2": "More than half the days",
  "gad7.scale.3": "Nearly every day",
  "gad7.difficulty.stem":
    "If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?",
  // The four difficulty options are stored as their English label string, not
  // as an option key (`misokinesia_gad7.difficulty_impact` is validated against
  // these exact strings). Only the displayed KO label comes from here.
  "gad7.difficulty.not_at_all": "Not difficult at all",
  "gad7.difficulty.somewhat": "Somewhat difficult",
  "gad7.difficulty.very": "Very difficult",
  "gad7.difficulty.extremely": "Extremely difficult",

  // --- 5.4 MAQ / MpAQ ----------------------------------------------------
  "maq.item.q1": "My sound issues currently make me unhappy.",
  "maq.item.q2": "My sound issues currently create problems for me.",
  "maq.item.q3": "My sound issues have recently made me feel angry.",
  "maq.item.q4": "I feel that no one understands my problems with certain sounds.",
  "maq.item.q5": "My sound issues do not seem to have a known cause.",
  "maq.item.q6": "My sound issues currently make me feel helpless.",
  "maq.item.q7": "My sound issues currently interfere with my social life.",
  "maq.item.q8": "My sound issues currently make me feel isolated.",
  "maq.item.q9":
    "My sound issues have recently created problems for me in groups.",
  "maq.item.q10":
    "My sound issues negatively affect my work/school life (currently or recently).",
  "maq.item.q11": "My sound issues currently make me feel frustrated.",
  "maq.item.q12": "My sound issues currently impact my entire life negatively.",
  "maq.item.q13": "My sound issues have recently made me feel guilty.",
  "maq.item.q14": "My sound issues are classified as 'crazy'.",
  "maq.item.q15": "I feel that no one can help me with my sound issues.",
  "maq.item.q16": "My sound issues currently make me feel hopeless.",
  "maq.item.q17": "I feel that my sound issues will only get worse with time.",
  "maq.item.q18": "My sound issues currently impact my family relationships.",
  "maq.item.q19":
    "My sound issues have recently affected my ability to be with other people.",
  "maq.item.q20": "My sound issues have not been recognized as legitimate.",
  "maq.item.q21":
    "I am worried that my whole life will be affected by sound issues.",
  "maq.scale.0": "Not at all",
  "maq.scale.1": "A little of the time",
  "maq.scale.2": "A good deal of the time",
  "maq.scale.3": "Almost all the time",

  // --- 5.5 End-of-task items ---------------------------------------------
  "end.item.fidgeting":
    "Please list any fidgeting stimuli that you are bothered by that did not show up in the task.",
  "end.item.emotions":
    "Please list any emotional responses that you felt during the videos that were not asked in the questionnaire.",
  "end.item.stronger_responses":
    "Did viewing the videos create stronger responses over time?",
  "end.timing.stem": "When did the responses feel stronger?",
  // Display side of the `timing_*` option keys. Correcting the KO wording never
  // changes the stored key.
  "end.timing.immediately": "Immediately",
  "end.timing.after_5s": "After 5 seconds",
  "end.timing.after_10s": "After 10 seconds",
  "end.timing.end_of_video": "At the end of the video",

  // --- 5.6 Demographics question stems -----------------------------------
  // Sheet `Demographics`. Rendered by `MisokinesiaDemographicsForm.tsx`. Option
  // labels are NOT here — they are option keys in `miso-option-labels.ts`.
  // Three KO stems are localized rather than translated: Q5 asks about Korea,
  // and Q13/Q14/Q15/Q16 swap the reference language English -> Korean. The
  // stored column names (`years_lived_canada`, `english_fluency`, …) are
  // unchanged; read them as "the session's reference country/language".
  "demo.q2": "Age",
  "demo.q3": "Sex",
  "demo.q4": "Gender Identity",
  "demo.q5": "For how many years have you lived in Canada?",
  "demo.q6": "What is your Residence Status?",
  "demo.q7": "What type of student are you?",
  "demo.q8":
    "What is your total number of years of education (excluding Kindergarten)?",
  "demo.q9": "What is your cumulative GPA?",
  "demo.q10": "What is/are your major(s)?",
  "demo.q27": "What is the highest level of education you have completed?",
  "demo.q11": "What is your ethnicity? Please check all that apply.",
  "demo.q12": "What is your native language?",
  "demo.q13": "I am fluent in English",
  "demo.q14":
    "In addition to English, which languages do you speak fluently? Please check all that apply.",
  "demo.q15": "In your everyday life, how often do you speak English?",
  "demo.q16":
    "Have you attended school where the language of instruction was different from English?",
  "demo.q17": "Which language(s) of instruction were used?",
  "demo.q18":
    "Have you ever been diagnosed with any of the following disorders? Please check all that apply.",
  "demo.q19": "Have you ever been diagnosed with ADHD by a physician?",
  "demo.q20":
    "Have you ever been prescribed medication by a physician for ADHD or to reduce ADHD symptoms?",
  "demo.q21": "Do you consider yourself an avid videogamer?",
  "demo.q28": "How many hours per week do you estimate you play video games?",
  "demo.q22": "Do you take any prescription stimulants?",
  "demo.q23": "Do you regularly use any of the following? Please check all that apply.",
  "demo.q24": "What is your relationship status?",
  "demo.q25": "What is your occupational status?",

  // --- 6.1 Shared chrome -------------------------------------------------
  "chrome.task.name": "Misokinesia Task",
  "chrome.step.trail": "Demographics → Intro → Task → Surveys",
  "chrome.step.consent": "Consent",
  "chrome.step.intro_position": "02 / 04",
  "chrome.step.end_position": "04 / 04",
  "chrome.choice.yes": "Yes",
  "chrome.choice.no": "No",

  // --- 6.2 Buttons and transient state -----------------------------------
  "chrome.button.back": "Back",
  "chrome.button.next": "Next",
  "chrome.button.next_arrow": "Next →",
  "chrome.button.previous": "← Previous",
  "chrome.button.continue": "Continue",
  "chrome.button.continue_arrow": "Continue →",
  "chrome.button.submit": "Submit",
  "chrome.button.retry": "Retry",
  "chrome.button.finish": "Finish →",
  "chrome.state.loading_session": "Loading session…",
  "chrome.state.saving": "Saving...",
  "chrome.state.saving_kicker": "Saving",
  "chrome.state.saving_results": "Saving your results…",
  "chrome.state.submitting": "Submitting…",
  "chrome.state.submitting_survey": "Submitting questionnaire…",

  // --- 6.3 Errors --------------------------------------------------------
  // Only the two platform-authored error strings live here. Server-produced
  // error text (via `getParticipantErrorMessage`) is out of scope.
  "chrome.error.session_kicker": "Session Error",
  "chrome.error.submission_kicker": "Submission Error",
  "chrome.error.manifest_missing":
    "Session data not found. Please ask the research assistant to restart the session.",
  "chrome.error.submit_failed": "Submission failed. Please try again.",
  "chrome.error.clip_load":
    "This clip could not be loaded. Please ask the research assistant to restart the session.",

  // --- 6.4 Consent gate and demographics chrome --------------------------
  "chrome.consent.kicker": "Before we begin",
  "chrome.consent.title": "Consent",
  "chrome.consent.body":
    "Do you consent to participate in this task and continue to the demographics questions?",
  "chrome.demographics.block_kicker": "Block {n} of {total}",
  "chrome.demographics.pane_suffix": "- Pane {n} of {m}",
  "chrome.demographics.block_title.1": "Participant basics",
  "chrome.demographics.block_title.2": "Residence and education",
  "chrome.demographics.block_title.3": "Language and ethnicity",
  "chrome.demographics.block_title.4": "Clinical history",
  "chrome.demographics.block_title.5": "Lifestyle and status",
  "chrome.demographics.pane_help":
    "Answer each visible question on this pane before continuing.",
  "chrome.demographics.validation_banner":
    "Please complete every visible question before continuing.",
  "chrome.demographics.field_required": "This visible question is required.",
  "chrome.demographics.other_placeholder": "Please specify",

  // --- 6.5 Intro card ----------------------------------------------------
  "chrome.intro.title": "Video Clip Questionnaire",
  "chrome.intro.body":
    "You will watch {n} short video clips. After each clip, you will be asked a few questions about how you felt. There are no right or wrong answers — just answer honestly.",
  "chrome.intro.meta.clips.label": "Clips",
  "chrome.intro.meta.clips.value": "{n} short video clips",
  "chrome.intro.meta.per_clip.label": "Per clip",
  "chrome.intro.meta.per_clip.value": "4 questions · scale 1–5",
  "chrome.intro.meta.after_clips.label": "After clips",
  "chrome.intro.meta.after_clips.value": "3 short surveys",
  "chrome.intro.meta.estimated.label": "Estimated",
  "chrome.intro.meta.estimated.value": "≈ 18 minutes total",
  // Names the Begin button inline: correct this string whenever
  // `chrome.intro.begin` is corrected. They are a pair.
  "chrome.intro.fullscreen_note":
    "The task will enter fullscreen when you click Begin. You can exit at any time using the button in the top corner.",
  "chrome.intro.begin": "Begin →",

  // --- 6.6 Survey transition cards ---------------------------------------
  "chrome.transition.strip.clips_complete": "Clips complete",
  "chrome.transition.strip.survey_count": "{n} / {m} surveys",
  "chrome.transition.kicker": "Up next · Survey {pos} of {total}",
  "chrome.transition.meta.items.label": "Items",
  "chrome.transition.meta.format.label": "Format",
  "chrome.transition.meta.scale.label": "Scale",
  "chrome.transition.meta.estimated.label": "Estimated",
  "chrome.transition.mkaq.title": "Misokinesia Assessment",
  "chrome.transition.mkaq.description":
    "A short questionnaire about how certain visual stimuli affect you. Answer based on the past two weeks. There are no right or wrong answers.",
  "chrome.transition.mkaq.meta.items": "21 statements",
  "chrome.transition.mkaq.meta.format": "4 panes · Previous available",
  "chrome.transition.mkaq.meta.scale":
    "0–3 · Not at all → Almost all",
  "chrome.transition.mkaq.meta.estimated": "≈ 5 minutes",
  "chrome.transition.gad7.title": "Anxiety Questionnaire",
  "chrome.transition.gad7.description":
    "Seven short questions about feelings of anxiety. Answer based on the past two weeks. There are no right or wrong answers.",
  "chrome.transition.gad7.meta.items": "7 statements",
  "chrome.transition.gad7.meta.format": "Single screen",
  "chrome.transition.gad7.meta.scale":
    "0–3 · Not at all → Nearly every day",
  "chrome.transition.gad7.meta.estimated": "≈ 1 minute",
  "chrome.transition.maq.title": "Misophonia Assessment",
  "chrome.transition.maq.description":
    "A short questionnaire about how certain sounds affect you. Answer based on the past two weeks. There are no right or wrong answers.",
  "chrome.transition.maq.meta.items": "21 statements",
  "chrome.transition.maq.meta.format": "3 panes · Previous available",
  "chrome.transition.maq.meta.scale":
    "0–3 · Not at all → Almost all",
  "chrome.transition.maq.meta.estimated": "≈ 5 minutes",
  "chrome.transition.begin_assessment": "Begin assessment →",
  "chrome.transition.begin_questionnaire": "Begin questionnaire →",
  "chrome.transition.pause_note":
    "Take a breath before continuing — you can pause between questions.",

  // --- 6.7 Clip playback and post-clip questionnaire ----------------------
  "chrome.clip.progress": "Clip {n} of {m}",
  "chrome.clip.progress_percent": "{pct}%",
  "chrome.clip.kicker": "Post-clip · 4 questions",
  "chrome.clip.heading": "How did you feel about that clip?",
  // Embeds the two endpoint anchors of the VMA scale: keep consistent with
  // `vma.scale.1` and `vma.scale.5`.
  "chrome.clip.help":
    "Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree). There are no right answers.",
  "chrome.clip.legend": "Q{n}: {text}",
  "chrome.clip.item_number": "Q{n}",
  "chrome.video.play": "Play Clip",
  "chrome.video.unsupported":
    "Your browser does not support embedded video playback.",

  // --- 6.8 Shared survey-form chrome -------------------------------------
  "chrome.form.answered_count": "{n}/{m} answered",
  "chrome.form.part_counter": "Part {n} / {m}",
  "chrome.form.item_range": "Items {a}–{b} of {n}",
  "chrome.form.rate_heading": "Please rate each statement",
  "chrome.form.item_legend": "{n}. {text}",
  "chrome.form.pane_progress": "{a}/{b} on this part • {c}/{d} overall",
  // The scale-legend strings abbreviate the real anchors to fit one line. They
  // are chrome: never substitute them for `mkaq.scale.*` / `gad7.scale.*` /
  // `maq.scale.*` when rendering an actual scale chip.
  "chrome.form.scale_legend_0_3":
    "0 · Not at all · 1 · A little · 2 · A good deal · 3 · Almost all the time",
  "chrome.mkaq.instrument_label": "MkAQ · Misokinesia Assessment",
  "chrome.maq.instrument_label": "MAQ · Misophonia Assessment",
  "chrome.gad7.instrument_label": "GAD-7 · Anxiety Assessment",
  "chrome.gad7.scale_legend":
    "0 · Not at all · 1 · Several days · 2 · More than half the days · 3 · Nearly every day",

  // --- 6.9 End-of-task and completion ------------------------------------
  "chrome.end.kicker": "End of task",
  "chrome.end.heading": "A few last questions",
  "chrome.end.help": "All fields are optional — answer as many as you like.",
  "chrome.end.optional_placeholder": "Optional — leave blank if none",
  "chrome.complete.kicker": "Session complete",
  "chrome.complete.title": "Thank you",
  "chrome.complete.body":
    "The session is complete. Please return this device to the research assistant.",
  "chrome.complete.back": "Back to Misokinesia",

  // --- 6.10 Fullscreen toggle --------------------------------------------
  "chrome.fullscreen.enter": "Fullscreen",
  "chrome.fullscreen.enter_aria": "Enter fullscreen",
  // Serves as both the visible label and the aria-label in the exit state.
  "chrome.fullscreen.exit": "Exit fullscreen",

  // --- 6.11 Trial-run section jumper (RA-only) ---------------------------
  // Rendered only in trial-run mode, which no participant enters. Keys exist so
  // the component holds no inline literal; leaving these English in a KO trial
  // run is acceptable and is not a defect.
  "chrome.jumper.aria": "Trial section jumps",
  "chrome.jumper.intro": "Intro",
  "chrome.jumper.clips": "Clips",
  "chrome.jumper.mkaq": "MkAQ",
  "chrome.jumper.gad7": "GAD-7",
  "chrome.jumper.maq": "MAQ",
  "chrome.jumper.end": "End",
  "chrome.jumper.done": "Done",

  // --- 6.13 RA Misokinesia launch page (RA-only) -------------------------
  // The single documented exception to "the RA dashboard is English-only":
  // `/misokinesia` renders in the locale the RA has selected so it is visible
  // at a glance which version is about to run. `ra.launch.*` keys are RA-facing
  // and deliberately kept out of the `chrome.*` namespace, whose count is
  // asserted against LOCALIZATION.md section 6.
  "ra.launch.kicker": "Misokinesia Study · Lab Operations",
  "ra.launch.title": "Misokinesia Task",
  "ra.launch.subtitle":
    "Launch a participant session, run a rehearsal trial, or review recent activity for this lab module.",
  "ra.launch.language.aria": "Session language",
  "ra.launch.language.en": "EN",
  "ra.launch.language.ko": "KO",
  "ra.launch.button.start": "Start Misokinesia Session",
  "ra.launch.button.short_trial": "Short Trial",
  "ra.launch.button.full_trial": "Full Trial",
  "ra.launch.state.starting": "Starting…",
  "ra.launch.state.loading": "Loading",
  "ra.launch.trial_note": "Trials use fake ids · no data is written",
  "ra.launch.stats.active_stimuli": "Active stimuli",
  "ra.launch.stats.active_stimuli_help": "clips available in the active test set",
  "ra.launch.recent.title": "Recent sessions",
  "ra.launch.recent.undo": "Undo last session",
  "ra.launch.recent.loading": "Loading recent sessions…",
  "ra.launch.recent.empty": "No sessions yet.",
  "ra.launch.scores.title": "Video Score Leaderboard",
  "ra.launch.scores.loading": "Loading video scores…",
  "ra.launch.scores.empty": "No video score data yet.",
  "ra.launch.scores.highest": "Highest reactivity",
  "ra.launch.scores.lowest": "Lowest reactivity",
  "ra.launch.time.just_now": "Just now",
  "ra.launch.time.minutes": "{n} min ago",
  "ra.launch.time.hours": "{h}h {m}m ago",
  "ra.launch.time.yesterday": "Yesterday · {time}",
  "ra.launch.error.dashboard": "Dashboard failed to load. Please refresh and try again.",
  "ra.launch.error.dashboard_status": "Dashboard failed to load ({status}): {message}",
  "ra.launch.error.start": "Failed to start session. Please try again.",
  "ra.launch.error.start_status": "Server error ({status}): {message}",
  "ra.launch.error.trial": "Failed to start trial mode. Please try again.",
  "ra.launch.error.trial_status": "Trial launch failed ({status}): {message}",
} as const;

/** Every display-only string key in the Misokinesia catalogue. */
export type MisoMessageKey = keyof typeof MISO_MESSAGES_EN;

/**
 * Korean catalogue. Typed as a total record over `MisoMessageKey`, so omitting a
 * key — or inventing one that has no EN counterpart — fails `tsc`.
 */
const MISO_MESSAGES_KO: Record<MisoMessageKey, string> = {
  // --- 5.1 VMA per-clip questionnaire ------------------------------------
  "vma.item.q1": "영상이 불쾌하였다.",
  "vma.item.q2": "영상 시청 중 신체적 불편감을 느꼈다.",
  "vma.item.q3": "영상 시청 중 정서적 불편감을 느꼈다.",
  "vma.item.q4": "영상을 멈추거나 눈을 감고 싶었다.",
  "vma.scale.1": "전혀 동의하지 않음",
  "vma.scale.2": "동의하지 않음",
  "vma.scale.3": "보통",
  "vma.scale.4": "동의함",
  "vma.scale.5": "매우 동의함",

  // --- 5.2 MkAQ ----------------------------------------------------------
  "mkaq.item.q1": "나는 시각 자극 문제로 인해 현재 불행하다.",
  "mkaq.item.q2": "나는 시각 자극 문제로 인해 현재 어려움을 겪고 있다.",
  "mkaq.item.q3": "나는 시각 자극 문제로 인해 최근 화가 났다.",
  "mkaq.item.q4": "특정 시각 자극에 대한 나의 문제를 아무도 이해하지 못한다고 느낀다.",
  "mkaq.item.q5": "나의 시각 자극 문제는 알려진 원인이 없는 것 같다.",
  "mkaq.item.q6": "나는 시각 자극 문제로 인해 현재 무력감을 느낀다.",
  "mkaq.item.q7": "나의 시각 자극 문제가 현재 사회생활을 방해하고 있다.",
  "mkaq.item.q8": "나는 시각 자극 문제로 인해 현재 고립감을 느낀다.",
  "mkaq.item.q9": "나는 시각 자극 문제로 인해 최근 집단 내에서 어려움을 겪었다.",
  "mkaq.item.q10":
    "나의 시각 자극 문제가 직장/학교생활에 부정적 영향을 미치고 있다(현재 또는 최근).",
  "mkaq.item.q11": "나는 시각 자극 문제로 인해 현재 좌절감을 느낀다.",
  "mkaq.item.q12": "나의 시각 자극 문제가 현재 삶 전체에 부정적 영향을 미치고 있다.",
  "mkaq.item.q13": "나는 시각 자극 문제로 인해 최근 죄책감을 느꼈다.",
  "mkaq.item.q14": "나의 시각 자극 문제는 '미쳤다'고 간주된다.",
  "mkaq.item.q15": "나의 시각 자극 문제를 도와줄 수 있는 사람이 아무도 없다고 느낀다.",
  "mkaq.item.q16": "나는 시각 자극 문제로 인해 현재 절망감을 느낀다.",
  "mkaq.item.q17": "나의 시각 자극 문제가 시간이 갈수록 악화될 것이라고 느낀다.",
  "mkaq.item.q18": "나의 시각 자극 문제가 현재 가족 관계에 영향을 미치고 있다.",
  "mkaq.item.q19":
    "나는 시각 자극 문제로 인해 최근 다른 사람들과 함께 있는 것이 어려웠다.",
  "mkaq.item.q20": "나의 시각 자극 문제는 정당한 것으로 인정받지 못하고 있다.",
  "mkaq.item.q21": "나의 시각 자극 문제는 평생 나에게 영향을 미칠까 봐 걱정된다.",
  "mkaq.scale.0": "전혀 아니다",
  "mkaq.scale.1": "가끔 그렇다",
  "mkaq.scale.2": "자주 그렇다",
  "mkaq.scale.3": "거의 항상 그렇다",

  // --- 5.3 GAD-7 (validated Korean GAD-7 — do not reword) -----------------
  "gad7.stem": "지난 2주 동안 당신은 다음의 문제들로 인해서 얼마나 자주 방해를 받았습니까?",
  "gad7.item.r1": "초조하거나 불안하거나 조마조마하게 느낀다.",
  "gad7.item.r2": "걱정하는 것을 멈추거나 조절할 수가 없다.",
  "gad7.item.r3": "여러 가지 것들에 대해 걱정을 너무 많이 한다.",
  "gad7.item.r4": "편하게 있기가 어렵다.",
  "gad7.item.r5": "너무 안절부절못해서 가만히 있기가 힘들다.",
  "gad7.item.r6": "쉽게 짜증이 나거나 쉽게 성을 내게 된다.",
  "gad7.item.r7": "마치 끔찍한 일이 생길 것처럼 두렵게 느껴진다.",
  "gad7.scale.0": "전혀 방해받지 않았다",
  "gad7.scale.1": "며칠 동안 방해 받았다",
  "gad7.scale.2": "2주 중 절반 이상 방해 받았다",
  "gad7.scale.3": "거의 매일 방해 받았다",
  "gad7.difficulty.stem":
    "위의 문제들 중 하나라도 해당되는 것이 있다면, 이러한 문제들로 인해 업무를 하거나, 집안일을 처리하거나, 다른 사람과 어울리는 것이 얼마나 어려웠습니까?",
  "gad7.difficulty.not_at_all": "전혀 어렵지 않았다",
  "gad7.difficulty.somewhat": "다소 어려웠다",
  "gad7.difficulty.very": "매우 어려웠다",
  "gad7.difficulty.extremely": "극도로 어려웠다",

  // --- 5.4 MAQ / MpAQ ----------------------------------------------------
  "maq.item.q1": "나는 청각 자극 문제로 인해 현재 불행하다.",
  "maq.item.q2": "나는 청각 자극 문제로 인해 현재 어려움을 겪고 있다.",
  "maq.item.q3": "나는 청각 자극 문제로 인해 최근 화가 났다.",
  "maq.item.q4": "특정 청각 자극에 대한 나의 문제를 아무도 이해하지 못한다고 느낀다.",
  "maq.item.q5": "나의 청각 자극 문제는 알려진 원인이 없는 것 같다.",
  "maq.item.q6": "나는 청각 자극 문제로 인해 현재 무력감을 느낀다.",
  "maq.item.q7": "나의 청각 자극 문제가 현재 사회생활을 방해하고 있다.",
  "maq.item.q8": "나는 청각 자극 문제로 인해 현재 고립감을 느낀다.",
  "maq.item.q9": "나는 청각 자극 문제로 인해 최근 집단 내에서 어려움을 겪었다.",
  "maq.item.q10":
    "나의 청각 자극 문제가 직장/학교생활에 부정적 영향을 미치고 있다(현재 또는 최근).",
  "maq.item.q11": "나는 청각 자극 문제로 인해 현재 좌절감을 느낀다.",
  "maq.item.q12": "나의 청각 자극 문제가 현재 삶 전체에 부정적 영향을 미치고 있다.",
  "maq.item.q13": "나는 청각 자극 문제로 인해 최근 죄책감을 느꼈다.",
  "maq.item.q14": "나의 청각 자극 문제는 '미쳤다'고 간주된다.",
  "maq.item.q15": "나의 청각 자극 문제를 도와줄 수 있는 사람이 아무도 없다고 느낀다.",
  "maq.item.q16": "나는 청각 자극 문제로 인해 현재 절망감을 느낀다.",
  "maq.item.q17": "나의 청각 자극 문제가 시간이 갈수록 악화될 것이라고 느낀다.",
  "maq.item.q18": "나의 청각 자극 문제가 현재 가족 관계에 영향을 미치고 있다.",
  "maq.item.q19":
    "나는 청각 자극 문제로 인해 최근 다른 사람들과 함께 있는 것이 어려웠다.",
  "maq.item.q20": "나의 청각 자극 문제는 정당한 것으로 인정받지 못하고 있다.",
  "maq.item.q21": "나의 청각 자극 문제는 평생 나에게 영향을 미칠까 봐 걱정된다.",
  "maq.scale.0": "전혀 아니다",
  "maq.scale.1": "가끔 그렇다",
  "maq.scale.2": "자주 그렇다",
  "maq.scale.3": "거의 항상 그렇다",

  // --- 5.5 End-of-task items ---------------------------------------------
  "end.item.fidgeting":
    "영상에 포함되지 않았으나 본인에게 어려움을 주는 타인의 반복적 움직임이 있다면 어떤 것인지 기술해 주십시오.",
  "end.item.emotions":
    "영상에 대해 느꼈으나 앞선 질문들로 포착되지 않은 정서나 반응이 있다면 어떤 것인지 기술해 주십시오.",
  "end.item.stronger_responses": "영상을 계속 시청하면서 반응이 점점 더 강해졌습니까?",
  "end.timing.stem": "반응이 더 강하게 느껴진 시점은 언제였습니까?",
  "end.timing.immediately": "즉시",
  "end.timing.after_5s": "5초 후",
  "end.timing.after_10s": "10초 후",
  "end.timing.end_of_video": "영상이 끝날 무렵",

  // --- 5.6 Demographics question stems -----------------------------------
  "demo.q2": "나이",
  "demo.q3": "생물학적 성별",
  "demo.q4": "성별 정체성",
  // Reference country localized: Canada -> Korea. Still stored as
  // `years_lived_canada`.
  "demo.q5": "한국에서 거주한 기간(연 단위)",
  "demo.q6": "체류 자격",
  "demo.q7": "학생 유형",
  "demo.q8": "총 교육 연수(유치원 제외)",
  "demo.q9": "누적 학점(GPA)",
  "demo.q10": "전공(복수전공 포함)",
  "demo.q27": "최종 학력",
  "demo.q11": "민족(해당하는 것 모두 선택)",
  "demo.q12": "모국어",
  // Reference language localized: English -> Korean (Q13, Q14, Q15, Q16).
  "demo.q13": "나는 한국어에 유창하다",
  "demo.q14": "한국어 외에 유창하게 구사하는 언어(해당하는 것 모두 선택)",
  "demo.q15": "일상생활에서 한국어를 사용하는 빈도",
  "demo.q16": "한국어 이외의 언어로 수업을 받은 적이 있습니까?",
  "demo.q17": "수업 언어는 무엇이었습니까?(해당하는 것 모두 선택)",
  "demo.q18": "다음 중 진단받은 적이 있는 장애가 있습니까?(해당하는 것 모두 선택)",
  "demo.q19": "의사로부터 ADHD 진단을 받은 적이 있습니까?",
  "demo.q20":
    "의사로부터 ADHD 또는 ADHD 증상을 줄이기 위한 약물을 처방받은 적이 있습니까?",
  "demo.q21": "본인이 게임을 즐기는 편이라고 생각하십니까?",
  "demo.q28": "일주일에 비디오 게임을 몇 시간 정도 하십니까?",
  "demo.q22": "현재 처방받은 각성제를 복용하고 있습니까?",
  "demo.q23": "다음 중 정기적으로 사용하는 것이 있습니까?(해당하는 것 모두 선택)",
  "demo.q24": "교제 상태",
  "demo.q25": "직업 상태",

  // --- 6.1 Shared chrome -------------------------------------------------
  "chrome.task.name": "미소키네시아 과제",
  "chrome.step.trail": "인구통계 → 안내 → 과제 → 설문",
  "chrome.step.consent": "동의",
  "chrome.step.intro_position": "02 / 04",
  "chrome.step.end_position": "04 / 04",
  "chrome.choice.yes": "예",
  "chrome.choice.no": "아니오",

  // --- 6.2 Buttons and transient state -----------------------------------
  "chrome.button.back": "이전",
  "chrome.button.next": "다음",
  "chrome.button.next_arrow": "다음 →",
  "chrome.button.previous": "← 이전",
  "chrome.button.continue": "계속",
  "chrome.button.continue_arrow": "계속 →",
  "chrome.button.submit": "제출",
  "chrome.button.retry": "다시 시도",
  "chrome.button.finish": "완료 →",
  "chrome.state.loading_session": "세션을 불러오는 중…",
  "chrome.state.saving": "저장 중...",
  "chrome.state.saving_kicker": "저장 중",
  "chrome.state.saving_results": "응답을 저장하는 중…",
  "chrome.state.submitting": "제출 중…",
  "chrome.state.submitting_survey": "설문을 제출하는 중…",

  // --- 6.3 Errors --------------------------------------------------------
  "chrome.error.session_kicker": "세션 오류",
  "chrome.error.submission_kicker": "제출 오류",
  "chrome.error.manifest_missing":
    "세션 데이터를 찾을 수 없습니다. 연구 보조원에게 세션 재시작을 요청해 주십시오.",
  "chrome.error.submit_failed": "제출에 실패했습니다. 다시 시도해 주십시오.",
  "chrome.error.clip_load":
    "영상을 불러올 수 없습니다. 연구 보조원에게 세션 재시작을 요청해 주십시오.",

  // --- 6.4 Consent gate and demographics chrome --------------------------
  "chrome.consent.kicker": "시작하기 전에",
  "chrome.consent.title": "연구 참가 동의",
  "chrome.consent.body":
    "본 과제에 참여하고 인구통계 문항으로 계속 진행하는 데 동의하십니까?",
  "chrome.demographics.block_kicker": "블록 {n} / {total}",
  "chrome.demographics.pane_suffix": "- 페이지 {n} / {m}",
  "chrome.demographics.block_title.1": "인적 사항",
  "chrome.demographics.block_title.2": "거주 및 교육",
  "chrome.demographics.block_title.3": "언어 및 민족",
  "chrome.demographics.block_title.4": "병력",
  "chrome.demographics.block_title.5": "생활 및 현재 상태",
  "chrome.demographics.pane_help":
    "계속하기 전에 이 페이지에 표시된 모든 문항에 답해 주십시오.",
  "chrome.demographics.validation_banner":
    "계속하려면 표시된 모든 문항에 답해 주십시오.",
  "chrome.demographics.field_required": "이 문항은 필수입니다.",
  "chrome.demographics.other_placeholder": "직접 입력해 주십시오",

  // --- 6.5 Intro card ----------------------------------------------------
  "chrome.intro.title": "영상 시청 설문",
  "chrome.intro.body":
    "{n}개의 짧은 영상을 시청하게 됩니다. 각 영상이 끝나면 어떻게 느꼈는지에 대한 몇 가지 질문에 답하게 됩니다. 정답이나 오답은 없으니 솔직하게 답해 주십시오.",
  "chrome.intro.meta.clips.label": "영상",
  "chrome.intro.meta.clips.value": "짧은 영상 {n}개",
  "chrome.intro.meta.per_clip.label": "영상당",
  "chrome.intro.meta.per_clip.value": "문항 4개 · 1–5점 척도",
  "chrome.intro.meta.after_clips.label": "영상 시청 후",
  "chrome.intro.meta.after_clips.value": "짧은 설문 3개",
  "chrome.intro.meta.estimated.label": "예상 소요",
  "chrome.intro.meta.estimated.value": "총 약 18분",
  "chrome.intro.fullscreen_note":
    "Begin을 누르면 과제가 전체 화면으로 전환됩니다. 화면 상단 모서리의 버튼으로 언제든지 종료할 수 있습니다.",
  "chrome.intro.begin": "시작 →",

  // --- 6.6 Survey transition cards ---------------------------------------
  "chrome.transition.strip.clips_complete": "영상 시청 완료",
  "chrome.transition.strip.survey_count": "설문 {n} / {m}",
  "chrome.transition.kicker": "다음 · 설문 {pos} / {total}",
  "chrome.transition.meta.items.label": "문항 수",
  "chrome.transition.meta.format.label": "형식",
  "chrome.transition.meta.scale.label": "척도",
  "chrome.transition.meta.estimated.label": "예상 소요",
  "chrome.transition.mkaq.title": "미소키네시아 평가",
  "chrome.transition.mkaq.description":
    "특정 시각 자극이 본인에게 미치는 영향을 묻는 짧은 설문입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다.",
  "chrome.transition.mkaq.meta.items": "문항 21개",
  "chrome.transition.mkaq.meta.format": "4개 페이지 · 이전으로 돌아가기 가능",
  "chrome.transition.mkaq.meta.scale":
    "0–3 · 전혀 아니다 → 거의 항상",
  "chrome.transition.mkaq.meta.estimated": "약 5분",
  "chrome.transition.gad7.title": "불안 설문",
  "chrome.transition.gad7.description":
    "불안감에 관한 짧은 7문항입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다.",
  "chrome.transition.gad7.meta.items": "문항 7개",
  "chrome.transition.gad7.meta.format": "한 화면",
  "chrome.transition.gad7.meta.scale":
    "0–3 · 전혀 방해받지 않았다 → 거의 매일",
  "chrome.transition.gad7.meta.estimated": "약 1분",
  "chrome.transition.maq.title": "미소포니아 평가",
  "chrome.transition.maq.description":
    "특정 소리가 본인에게 미치는 영향을 묻는 짧은 설문입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다.",
  "chrome.transition.maq.meta.items": "문항 21개",
  "chrome.transition.maq.meta.format": "3개 페이지 · 이전으로 돌아가기 가능",
  "chrome.transition.maq.meta.scale":
    "0–3 · 전혀 아니다 → 거의 항상",
  "chrome.transition.maq.meta.estimated": "약 5분",
  "chrome.transition.begin_assessment": "평가 시작 →",
  "chrome.transition.begin_questionnaire": "설문 시작 →",
  "chrome.transition.pause_note":
    "계속하기 전에 잠시 쉬어도 됩니다. 문항 사이에 언제든 멈출 수 있습니다.",

  // --- 6.7 Clip playback and post-clip questionnaire ----------------------
  "chrome.clip.progress": "영상 {n} / {m}",
  "chrome.clip.progress_percent": "{pct}%",
  "chrome.clip.kicker": "영상 시청 후 · 문항 4개",
  "chrome.clip.heading": "방금 본 영상에 대해 어떻게 느끼셨습니까?",
  "chrome.clip.help":
    "각 문장을 1(전혀 동의하지 않음)에서 5(매우 동의함)까지로 평가해 주십시오. 정답은 없습니다.",
  "chrome.clip.legend": "문항 {n}: {text}",
  "chrome.clip.item_number": "문항 {n}",
  "chrome.video.play": "영상 재생",
  "chrome.video.unsupported": "이 브라우저는 내장 영상 재생을 지원하지 않습니다.",

  // --- 6.8 Shared survey-form chrome -------------------------------------
  "chrome.form.answered_count": "{n}/{m} 응답 완료",
  "chrome.form.part_counter": "파트 {n} / {m}",
  "chrome.form.item_range": "문항 {a}–{b} / {n}",
  "chrome.form.rate_heading": "각 문장을 평가해 주십시오",
  "chrome.form.item_legend": "{n}. {text}",
  "chrome.form.pane_progress": "이 파트 {a}/{b} · 전체 {c}/{d}",
  "chrome.form.scale_legend_0_3":
    "0 · 전혀 아니다 · 1 · 가끔 · 2 · 자주 · 3 · 거의 항상 그렇다",
  "chrome.mkaq.instrument_label": "MkAQ · 미소키네시아 평가",
  "chrome.maq.instrument_label": "MAQ · 미소포니아 평가",
  "chrome.gad7.instrument_label": "GAD-7 · 불안 평가",
  "chrome.gad7.scale_legend":
    "0 · 전혀 방해받지 않았다 · 1 · 며칠 · 2 · 2주 중 절반 이상 · 3 · 거의 매일",

  // --- 6.9 End-of-task and completion ------------------------------------
  "chrome.end.kicker": "과제 종료",
  "chrome.end.heading": "마지막 몇 가지 질문",
  "chrome.end.help": "모든 문항은 선택 사항입니다. 원하시는 만큼만 답해 주십시오.",
  "chrome.end.optional_placeholder": "선택 사항 — 없으면 비워 두십시오",
  "chrome.complete.kicker": "세션 완료",
  "chrome.complete.title": "감사합니다",
  "chrome.complete.body": "세션이 완료되었습니다. 이 기기를 연구 보조원에게 돌려주십시오.",
  "chrome.complete.back": "미소키네시아로 돌아가기",

  // --- 6.10 Fullscreen toggle --------------------------------------------
  "chrome.fullscreen.enter": "전체 화면",
  "chrome.fullscreen.enter_aria": "전체 화면 시작",
  "chrome.fullscreen.exit": "전체 화면 종료",

  // --- 6.11 Trial-run section jumper (RA-only) ---------------------------
  "chrome.jumper.aria": "리허설 구간 이동",
  "chrome.jumper.intro": "안내",
  "chrome.jumper.clips": "영상",
  "chrome.jumper.mkaq": "MkAQ",
  "chrome.jumper.gad7": "GAD-7",
  "chrome.jumper.maq": "MAQ",
  "chrome.jumper.end": "종료",
  "chrome.jumper.done": "완료",

  // --- 6.13 RA Misokinesia launch page (RA-only) -------------------------
  "ra.launch.kicker": "미소키네시아 연구 · 실험실 운영",
  "ra.launch.title": "미소키네시아 과제",
  "ra.launch.subtitle":
    "참가자 세션을 시작하거나 리허설을 실행하고, 이 모듈의 최근 활동을 확인하세요.",
  "ra.launch.language.aria": "세션 언어",
  "ra.launch.language.en": "EN",
  "ra.launch.language.ko": "KO",
  "ra.launch.button.start": "미소키네시아 세션 시작",
  "ra.launch.button.short_trial": "짧은 리허설",
  "ra.launch.button.full_trial": "전체 리허설",
  "ra.launch.state.starting": "시작하는 중…",
  "ra.launch.state.loading": "불러오는 중",
  "ra.launch.trial_note": "리허설은 가짜 ID를 사용하며 데이터가 저장되지 않습니다",
  "ra.launch.stats.active_stimuli": "활성 자극",
  "ra.launch.stats.active_stimuli_help": "활성 테스트 세트에서 사용할 수 있는 영상 수",
  "ra.launch.recent.title": "최근 세션",
  "ra.launch.recent.undo": "마지막 세션 취소",
  "ra.launch.recent.loading": "최근 세션을 불러오는 중…",
  "ra.launch.recent.empty": "아직 세션이 없습니다.",
  "ra.launch.scores.title": "영상 점수 순위",
  "ra.launch.scores.loading": "영상 점수를 불러오는 중…",
  "ra.launch.scores.empty": "아직 영상 점수 데이터가 없습니다.",
  "ra.launch.scores.highest": "반응이 가장 높은 영상",
  "ra.launch.scores.lowest": "반응이 가장 낮은 영상",
  "ra.launch.time.just_now": "방금 전",
  "ra.launch.time.minutes": "{n}분 전",
  "ra.launch.time.hours": "{h}시간 {m}분 전",
  "ra.launch.time.yesterday": "어제 · {time}",
  "ra.launch.error.dashboard": "대시보드를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.",
  "ra.launch.error.dashboard_status": "대시보드를 불러오지 못했습니다 ({status}): {message}",
  "ra.launch.error.start": "세션을 시작하지 못했습니다. 다시 시도해 주세요.",
  "ra.launch.error.start_status": "서버 오류 ({status}): {message}",
  "ra.launch.error.trial": "리허설을 시작하지 못했습니다. 다시 시도해 주세요.",
  "ra.launch.error.trial_status": "리허설 시작 실패 ({status}): {message}",
};

export const MISO_MESSAGES: Readonly<
  Record<MisoLocale, Readonly<Record<MisoMessageKey, string>>>
> = {
  en: MISO_MESSAGES_EN,
  ko: MISO_MESSAGES_KO,
};

/** Values substituted into `{name}` placeholders. */
export type MisoMessageParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Resolve a catalogue key plus locale to a display string, substituting any
 * `{name}` placeholders.
 *
 * A placeholder with no matching param is left in place rather than blanked, so
 * a missing value is visible in review instead of silently disappearing from a
 * participant screen.
 */
export function misoMessage(
  key: MisoMessageKey,
  locale: MisoLocale,
  params?: MisoMessageParams,
): string {
  const template = MISO_MESSAGES[locale][key];
  if (!params) {
    return template;
  }
  return template.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
