-- Private Blob pathname; absent when storage was unavailable.
ALTER TABLE swipe_applications ADD COLUMN cv_file text;
