library(readxl)
library(openxlsx)
file.exists("~/Desktop/ww_qualtrics.xlsx")
qualtrics_data <- read_excel("~/Desktop/ww_qualtrics.xlsx")
demographics_data <- qualtrics_data[, c(1, 18, 19, 20, 21,23, 25, 27 )]
write.xlsx(demographics_data, "~/Desktop/demographics_data.xlsx", rowNames = FALSE)

uls_data<- qualtrics_data[, c(1,19, 28, 29, 30, 31, 32, 33, 34,35)]
write.xlsx(uls_data, "~/Desktop/uls_data.xlsx", rowNames = FALSE)

cesd_data<- qualtrics_data[, c(1,19, 36,37,38,39,40,41,42,43,44,45)]
write.xlsx(cesd_data, "~/Desktop/cesd_data.xlsx", rowNames = FALSE)

gad_data<- qualtrics_data[, c(1,19, 46,47,48,49,50,51,52,53)]
write.xlsx(gad_data, "~/Desktop/gad_data.xlsx", rowNames = FALSE)

cog_data<- qualtrics_data[, c(1,19, 54,55,56,57,58,59,60,61)]
write.xlsx(cog_data, "~/Desktop/cog.xlsx", rowNames = FALSE)

#sum ULS (can also use for the CESD)
library(readxl)
library(openxlsx)

# Step 1: Read your data (assign it!)
uls_data <- read_xlsx("~/Desktop/uls_data.xlsx")

test_score_cols <- c(3,4,5,6,7,8,9,10)

# Function to extract leading numbers from strings
extract_number <- function(x) {
  x <- trimws(x)
  num <- sub("^([0-9]+).*", "\\1", x)
  as.numeric(num)
}

# Step 2: Apply the extraction function to each test score column
uls_data[, test_score_cols] <- lapply(uls_data[, test_score_cols], extract_number)

# Step 3: Calculate total score by summing the numeric columns
uls_data$TotalScore <- rowSums(uls_data[, test_score_cols], na.rm = TRUE)

# Step 4: Select desired columns for output
output_df <- uls_data[, c("Q20", "TotalScore")]

# Step 5: Write to new Excel file
write.xlsx(output_df, "~/Desktop/uls_sum.xlsx", rowNames = FALSE)

#!/usr/bin/env Rscript
# Convert columns C–J to integers, reverse-score specific columns, and add sum/avg columns
# ----------------------------------------------------------------------------------------
# Usage:
#   Rscript convert_score_columns.R
# Output:
#   "<input_basename>_cleaned.xlsx"

# Load packages ----
suppressPackageStartupMessages({
  library(readxl)
  library(writexl)
  library(dplyr)
  library(stringr)
  library(tools)
})

# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> EDIT THIS ONLY <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
INPUT_XLSX <- "/Users/gloriagu/Desktop/uls_data.xlsx"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

# Function: get output file name ----
build_output_name <- function(input_path) {
  stem <- file_path_sans_ext(basename(input_path))
  file.path(dirname(input_path), paste0(stem, "_cleaned.xlsx"))
}

# Function: extract first digit or numeric (vectorized) ----
first_digit_to_int <- function(x) {
  suppressWarnings(num <- as.numeric(x))
  result <- ifelse(!is.na(num),
                   as.integer(num),
                   as.integer(str_extract(as.character(x), "\\d")))
  result[is.na(result)] <- NA_integer_
  result
}

# Function: reverse-score items on a 1–4 scale ----
reverse_1_to_4 <- function(x) {
  ifelse(is.na(x), NA_integer_, 5 - x)
}

# Main ----
main <- function() {
  in_path <- normalizePath(INPUT_XLSX, mustWork = FALSE)
  if (!file.exists(in_path)) {
    stop(paste("ERROR: File not found:", in_path))
  }
  
  df <- read_excel(in_path, sheet = 1)
  
  if (ncol(df) < 10) {
    stop("ERROR: The sheet has fewer than 10 columns; cannot map C–J.")
  }
  
  cols_c_to_j <- names(df)[3:10]  # Columns C–J (3rd to 10th)
  
  # Convert selected columns to integers
  df <- df %>%
    mutate(across(all_of(cols_c_to_j), first_digit_to_int))
  
  # Reverse-score column E (Q3) and H (Q6)
  # Column E is the 5th column, H is the 8th column
  q3_col <- names(df)[5]
  q6_col <- names(df)[8]
  
  df <- df %>%
    mutate(
      !!q3_col := reverse_1_to_4(.data[[q3_col]]),
      !!q6_col := reverse_1_to_4(.data[[q6_col]])
    )
  
  # Add sum and average across columns C–J
  df <- df %>%
    mutate(
      sum_score = rowSums(select(., all_of(cols_c_to_j)), na.rm = TRUE),
      avg_score = rowMeans(select(., all_of(cols_c_to_j)), na.rm = TRUE)
    )
  
  # Write output
  out_path <- build_output_name(in_path)
  write_xlsx(df, path = out_path)
  
  message("Wrote: ", out_path)
}

# Run script
main()



#!/usr/bin/env Rscript
# Convert columns C–J to integers and add sum/avg columns
# --------------------------------------------------------
# Usage:
# - Place this script in the same folder as your Excel file.
# - Edit the INPUT_XLSX variable below.
# - Run:  Rscript convert_score_columns.R
# - Output: "<input_basename>_cleaned.xlsx"

# Load packages ----
install.packages("stringr")
suppressPackageStartupMessages({
  library(readxl)
  library(writexl)
  library(dplyr)
  library(stringr)
  library(tools)
})

# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> EDIT THIS ONLY <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
INPUT_XLSX <- "/Users/gloriagu/Desktop/gad_data.xlsx"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

# Function: get output file name ----
build_output_name <- function(input_path) {
  stem <- file_path_sans_ext(basename(input_path))
  file.path(dirname(input_path), paste0(stem, "_cleaned.xlsx"))
}

# Function: extract first digit or numeric ----
first_digit_to_int <- function(x) {
  # Return NA for missing values
  x[is.na(x)] <- NA
  
  # Try numeric conversion first
  suppressWarnings(num <- as.numeric(x))
  
  # For non-numeric entries, extract first digit
  result <- ifelse(!is.na(num), as.integer(num),
                   as.integer(str_extract(x, "\\d")))
  
  # Convert invalids to NA
  result[is.na(result)] <- NA_integer_
  return(result)
}
  

# Main ----
main <- function() {
  in_path <- normalizePath(INPUT_XLSX, mustWork = FALSE)
  if (!file.exists(in_path)) {
    stop(paste("ERROR: File not found:", in_path))
  }
  
  df <- read_excel(in_path, sheet = 1)
  
  if (ncol(df) < 10) {
    stop("ERROR: The sheet has fewer than 10 columns; cannot map C–J.")
  }
  
  cols_c_to_j <- names(df)[3:10]  # Columns C–J (3rd to 10th)
  
  # Convert selected columns
  df <- df %>%
    mutate(across(all_of(cols_c_to_j), first_digit_to_int))
  
  # Add sum and average
  df <- df %>%
    mutate(
      sum_score = rowSums(select(., all_of(cols_c_to_j)), na.rm = TRUE),
      avg_score = rowMeans(select(., all_of(cols_c_to_j)), na.rm = TRUE)
    )
  
  # Write output
  out_path <- build_output_name(in_path)
  write_xlsx(df, path = out_path)
  
  message("Wrote: ", out_path)
}

# Run script
main()

#!/usr/bin/env Rscript
# Convert columns C–J to integers, reverse-score specific columns, and add sum/avg columns
# ----------------------------------------------------------------------------------------
# Usage:
#   Rscript convert_score_columns.R
# Output:
#   "<input_basename>_cleaned.xlsx"

# Load packages ----
suppressPackageStartupMessages({
  library(readxl)
  library(writexl)
  library(dplyr)
  library(stringr)
  library(tools)
})

# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> EDIT THIS ONLY <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
INPUT_XLSX <- "/Users/gloriagu/Desktop/cesd_data.xlsx"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

# Function: get output file name ----
build_output_name <- function(input_path) {
  stem <- file_path_sans_ext(basename(input_path))
  file.path(dirname(input_path), paste0(stem, "_cleaned.xlsx"))
}

# Function: extract first digit or numeric (vectorized) ----
first_digit_to_int <- function(x) {
  suppressWarnings(num <- as.numeric(x))
  result <- ifelse(!is.na(num),
                   as.integer(num),
                   as.integer(str_extract(as.character(x), "\\d")))
  result[is.na(result)] <- NA_integer_
  result
}

# Function: reverse-score items on a 1–4 scale ----
reverse_1_to_4 <- function(x) {
  ifelse(is.na(x), NA_integer_, 5 - x)
}

# Main ----
main <- function() {
  in_path <- normalizePath(INPUT_XLSX, mustWork = FALSE)
  if (!file.exists(in_path)) {
    stop(paste("ERROR: File not found:", in_path))
  }
  
  df <- read_excel(in_path, sheet = 1)
  
  if (ncol(df) < 10) {
    stop("ERROR: The sheet has fewer than 10 columns; cannot map C–J.")
  }
  
  cols_c_to_j <- names(df)[3:12]  # Columns C–J (3rd to 10th)
  
  # Convert selected columns to integers
  df <- df %>%
    mutate(across(all_of(cols_c_to_j), first_digit_to_int))
  
  # Reverse-score column E (Q3) and H (Q6)
  # Column E is the 5th column, H is the 8th column
  q3_col <- names(df)[7]
  q6_col <- names(df)[10]
  
  df <- df %>%
    mutate(
      !!q3_col := reverse_1_to_4(.data[[q3_col]]),
      !!q6_col := reverse_1_to_4(.data[[q6_col]])
    )
  
  # Add sum and average across columns C–J
  df <- df %>%
    mutate(
      sum_score = rowSums(select(., all_of(cols_c_to_j)), na.rm = TRUE),
      avg_score = rowMeans(select(., all_of(cols_c_to_j)), na.rm = TRUE)
    )
  
  # Write output
  out_path <- build_output_name(in_path)
  write_xlsx(df, path = out_path)
  
  message("Wrote: ", out_path)
}

# Run script
main()

# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> EDIT THIS ONLY <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
INPUT_XLSX <- "/Users/gloriagu/Desktop/cog.xlsx"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

# Function: get output file name ----
build_output_name <- function(input_path) {
  stem <- file_path_sans_ext(basename(input_path))
  file.path(dirname(input_path), paste0(stem, "_cleaned.xlsx"))
}

# Function: extract first digit or numeric ----
first_digit_to_int <- function(x) {
  # Return NA for missing values
  x[is.na(x)] <- NA
  
  # Try numeric conversion first
  suppressWarnings(num <- as.numeric(x))
  
  # For non-numeric entries, extract first digit
  result <- ifelse(!is.na(num), as.integer(num),
                   as.integer(str_extract(x, "\\d")))
  
  # Convert invalids to NA
  result[is.na(result)] <- NA_integer_
  return(result)
}


# Main ----
main <- function() {
  in_path <- normalizePath(INPUT_XLSX, mustWork = FALSE)
  if (!file.exists(in_path)) {
    stop(paste("ERROR: File not found:", in_path))
  }
  
  df <- read_excel(in_path, sheet = 1)
  
  if (ncol(df) < 10) {
    stop("ERROR: The sheet has fewer than 10 columns; cannot map C–J.")
  }
  
  cols_c_to_j <- names(df)[3:10]  # Columns C–J (3rd to 10th)
  
  # Convert selected columns
  df <- df %>%
    mutate(across(all_of(cols_c_to_j), first_digit_to_int))
  
  # Add sum and average
  df <- df %>%
    mutate(
      sum_score = rowSums(select(., all_of(cols_c_to_j)), na.rm = TRUE),
      avg_score = rowMeans(select(., all_of(cols_c_to_j)), na.rm = TRUE)
    )
  
  # Write output
  out_path <- build_output_name(in_path)
  write_xlsx(df, path = out_path)
  
  message("Wrote: ", out_path)
}

#Binning
# Run script
library(readxl)
library(writexl)
main <- function() {
  ww_data <- read_xlsx("~/Desktop/data_full_1-230_fixed_daytime (1).xlsx")
  
  if (!"date" %in% names(ww_data)) {
    stop(paste("Column 'date' not found. Columns found:", paste(names(ww_data), collapse = ", ")))
  }
  
  ww_data$date <- as.POSIXct(ww_data$date)
  if (any(is.na(ww_data$date))) {
    bad_count <- sum(is.na(ww_data$date))
    cat("Warning:", bad_count, "rows have invalid dates and were set to NA.\n")
    cat("Those rows will still get a bin; NA values will be grouped together.\n")
  }
  
  unique_dates <- sort(unique(ww_data$date))
  date_to_bin <- setNames(seq_along(unique_dates), unique_dates)
  ww_data$date_bin <- date_to_bin[as.character(ww_data$date)]
  
  # Insert date_bin right after date
  date_idx <- match("date", names(ww_data))
  new_order <- append(names(ww_data), "date_bin", after = date_idx)
  new_order <- unique(new_order)
  ww_data <- ww_data[, new_order]
  
  write_xlsx(ww_data, "~/Desktop/data_full_bins.xlsx")
  
  cat("Done. Wrote: ~/Desktop/data_full_bins.xlsx\n")
}

main()

##START HERE FOR MLM ANALYSIS
library(readxl)
ww_data <- read_xlsx("~/Desktop/data_full_bins.xlsx")

##START HERE FOR MLM ANALYSIS

## Load packages
library(car)
library(lubridate)

ww_data <- ww_data %>%
  mutate(
    # --- Normalize daytime (handles Excel fractions + HH:MM:SS text) ---
    daytime = as.character(daytime),
    daytime = ifelse(
      grepl(":", daytime),
      daytime,
      as.character(as_hms(as.numeric(daytime) * 86400))
    ),
    daytime = as_hms(daytime),
    
    # --- Other columns ---
    gender = factor(gender),
    origin = factor(origin),
    commute_method = factor(commute_method),
    time_outside = factor(time_outside, ordered = TRUE),
    self_report = as.numeric(self_report),
    
    # --- Parse sunrise time / derive daylight ---
    sunrise_time = daytime,
    sunrise_hours = hour(sunrise_time) +
      minute(sunrise_time) / 60 +
      second(sunrise_time) / 3600,
    
    daylight_hours = pmax(16 - sunrise_hours, 0)
  )

ww_data$age_simple <- factor(
  ifelse(as.character(ww_data$age) %in% c("32-38", "Over 38"), "32-38", "Over 38")
)

table(ww_data$age_simple)

## Make sure relevant variables are numeric
ww_data$self_report <- as.numeric(ww_data$self_report)
ww_data$digit_span_score <- as.numeric(ww_data$digit_span_score)
ww_data$temperature <- as.numeric(ww_data$temperature)
ww_data$precipitation <- as.numeric(ww_data$precipitation)
ww_data$daylight_hours <- as.numeric(ww_data$daylight_hours)
ww_data$anxiety <- as.numeric(ww_data$anxiety)
ww_data$loneliness <- as.numeric(ww_data$loneliness)
ww_data$depression <- as.numeric(ww_data$depression)

# Apply sum contrasts
contrasts(ww_data$origin) <- contr.sum
contrasts(ww_data$commute_method) <- contr.sum
contrasts(ww_data$gender) <- contr.sum

#multiple regression

#center variables (z-score)

library(dplyr)
library(lubridate)
ww_data <- ww_data %>%
  mutate(
    precipitation_z = as.numeric(scale(precipitation)),
    temperature_z = as.numeric(scale(temperature)),
    daylight_z = as.numeric(scale(daylight_hours)),
    anxiety_z = as.numeric(scale(anxiety)),
    depression_z = as.numeric(scale(depression)),
    loneliness_z = as.numeric(scale(loneliness)),
    self_report_z = as.numeric(scale(self_report)),
    digit_span_z = as.numeric(scale(digit_span_score))
  )



# -------------------------------
# MLM
# -------------------------------

library(lme4)

#cog

digit_span_mlm <- lmer(
 digit_span_z ~ temperature_z + precipitation_z*depression_z + daylight_z*depression_z + precipitation_z*loneliness_z +
    anxiety_z + (1 | date_bin),
  data = ww_data
)

summary(digit_span_mlm)


self_report_mlm <- lmer(
  self_report_z ~ 
    temperature_z + precipitation_z*depression_z + daylight_z*depression_z + precipitation_z*loneliness_z +
    anxiety_z + (1 | date_bin),
  data = ww_data
)

summary(self_report_mlm)

#--------------------------
#Graphs
#--------------------------

#Temp v Self Report
library(ggplot2)

# partial residuals for temperature
ww_data$partial_resid_ts <- resid(self_report_mlm) +
  fixef(self_report_mlm)["temperature_z"] * ww_data$temperature_z

ggplot(ww_data, aes(x = temperature_z, y = partial_resid_ts)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Average Temperature on Self-Reported Cognition",
    x = "Temperature (z)",
    y = "Partial residuals"
  ) +
  theme_minimal(base_size = 14)

#Backwards Digit span V Temp

# partial residuals for temperature
ww_data$partial_resid_ts <- resid(digit_span_mlm) +
  fixef(digit_span_mlm)["temperature_z"] * ww_data$temperature_z

ggplot(ww_data, aes(x = temperature_z, y = partial_resid_ts)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Average Temperature on \nCognitive Performance on Backwards Digit Span",
    x = "Temperature (z)",
    y = "Partial residuals"
  ) +
  theme_minimal(base_size = 14)

#Self-Report v Precipitation


ww_data$partial_resid_ps <- residuals(self_report_mr) + 
  coef(self_report_mr)["precipitation_c"] * ww_data$precipitation_c

ggplot(ww_data, aes(x = precipitation_c, y = partial_resid_ps)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Average Precipitation on Daily Self-Reported Cognitive Performance",
    x = "Precipitation (centered)",
    y = "Partial Residuals (Self-Report | Covariates Controlled)"
  ) +
  theme_minimal(base_size = 14)



#Digit Span v Precip

ww_data$partial_resid_pds <- residuals(digit_span_mr) + 
  coef(digit_span_mr)["precipitation_c"] * ww_data$precipitation_c

ggplot(ww_data, aes(x = precipitation_c, y = partial_resid_pds)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Average Precipitation on Daily Backwards Digit Span Performance",
    x = "Precipitation (centered)",
    y = "Partial Residuals (Backwards Digit Span Score | Covariates Controlled)"
  ) +
  theme_minimal(base_size = 14)


#Self Report v Daylight

# partial residuals for temperature
ww_data$partial_resid_ds <- resid(self_report_mlm) +
  fixef(self_report_mlm)["daylight_z"] * ww_data$daylight_z

ggplot(ww_data, aes(x = daylight_z, y = partial_resid_ds)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Daylight on Self-Reported Cognition",
    x = "Daylight (z)",
    y = "Partial residuals"
  ) +
  theme_minimal(base_size = 14)


#Daylight v Digit Span

# partial residuals for temperature
ww_data$partial_resid_dd <- resid(digit_span_mlm) +
  fixef(digit_span_mlm)["daylight_z"] * ww_data$daylight_z

ggplot(ww_data, aes(x = daylight_z, y = partial_resid_dd)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Daily Daylight on Backwards Digit Span Performance",
    x = "Daylight (z)",
    y = "Partial residuals"
  ) +
  theme_minimal(base_size = 14)

#self report - depression

library(ggplot2)
library(lme4)

# partial residuals for depression
ww_data$partial_resid_dep <- resid(self_report_mlm) +
  fixef(self_report_mlm)["depression_z"] * ww_data$depression_z

ggplot(ww_data, aes(x = depression_z, y = partial_resid_dep)) +
  geom_point(alpha = 0.7, size = 1) +
  geom_smooth(method = "lm", se = FALSE, linewidth = 0.4, color = "black") +
  labs(
    title = "Adjusted Effect of Depression on Self-Reported Cognition",
    x = "Depression (z)",
    y = "Partial residuals"
  ) +
  theme_minimal(base_size = 14)



