"""Feature contract shared by train_model.py, predict_bridge.py, and the
Flask backend's server-side feature computation. Keeping this in one place
means the trained pipeline and the code that feeds it live data can never
drift out of sync on column names.

Every field here has a direct, honest source in StayEd's own schema:
  age             <- learner.date_of_birth (as of enrollment/today)
  sex             <- learner.sex                      (MALE / FEMALE)
  learning_level  <- learning_class.learning_level     (BLP / ELEMENTARY / ...)
  modality        <- class_enrollment.learning_modality(FACE_TO_FACE / MODULAR / BLENDED)
  is_re_enrollee  <- class_enrollment.is_re_enrollee   (nullable boolean -> 0/1)
  distance_km     <- class_enrollment.distance_from_clc_km (nullable)
"""

NUMERIC_FEATURES = ["age", "distance_km"]
CATEGORICAL_FEATURES = ["sex", "learning_level", "modality"]
BOOLEAN_FEATURES = ["is_re_enrollee"]
FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES + BOOLEAN_FEATURES

TARGET_COLUMN = "target_not_completed"  # 1 = NotCompleted (at-risk), 0 = Completed