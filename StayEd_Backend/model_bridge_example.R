#!/usr/bin/env Rscript

# StayEd Random Forest bridge for Flask.
#
# Input  (stdin): one JSON object containing the exact predictor names used
#                  by the saved R model.
# Output (stdout): {"risk_probability": 0.0-1.0, "factors": []}
#
# Save the final trained model first, e.g.:
#   saveRDS(final_rf_model, "models/stayed_random_forest.rds")
#
# Configure backend/.env:
#   STAYED_R_MODEL=models/stayed_random_forest.rds
#   STAYED_RISK_CLASS=NotCompleted
#   MODEL_COMMAND=Rscript model_bridge_example.R

suppressPackageStartupMessages(library(jsonlite))

model_path <- Sys.getenv("STAYED_R_MODEL", unset = "")
risk_class <- Sys.getenv("STAYED_RISK_CLASS", unset = "NotCompleted")

if (model_path == "" || !file.exists(model_path)) {
  stop("STAYED_R_MODEL does not point to a readable .rds model file.")
}

payload_text <- paste(readLines(file("stdin"), warn = FALSE), collapse = "\n")
if (trimws(payload_text) == "") {
  stop("No JSON feature payload was received on stdin.")
}

payload <- fromJSON(payload_text, simplifyVector = TRUE)
if (!is.list(payload)) {
  stop("Prediction payload must be a JSON object.")
}

# Remove API-only fields that are never model predictors.
ignore <- c("learner_id", "monitoring_start_date", "monitoring_end_date")
payload[intersect(names(payload), ignore)] <- NULL

newdata <- as.data.frame(payload, stringsAsFactors = FALSE, check.names = FALSE)
model <- readRDS(model_path)

# Works for caret::train and randomForest classification objects that support
# predict(..., type = "prob"). The dropout-risk class should normally be the
# non-completion class (for example "NotCompleted"), not "Completed".
prob <- predict(model, newdata = newdata, type = "prob")

if (is.vector(prob) && length(prob) == 1) {
  risk_probability <- as.numeric(prob[[1]])
} else {
  prob <- as.data.frame(prob)
  if (!(risk_class %in% names(prob))) {
    stop(sprintf(
      "Risk class '%s' is not present in probability columns: %s",
      risk_class,
      paste(names(prob), collapse = ", ")
    ))
  }
  risk_probability <- as.numeric(prob[[risk_class]][1])
}

if (!is.finite(risk_probability) || risk_probability < 0 || risk_probability > 1) {
  stop("Model returned an invalid risk probability.")
}

cat(toJSON(
  list(
    risk_probability = risk_probability,
    factors = list()
  ),
  auto_unbox = TRUE,
  digits = 10
))
