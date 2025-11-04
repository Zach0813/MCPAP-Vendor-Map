# Unreleased (working notes)
# Unreleased — upcoming patch
# Unreleased — upcoming patch
Date: 2025-10-30

Quick summary
-------------
- Improved legend visuals (icons larger and clearer).
- Admin Business Address uses Google Places autocomplete (legacy Autocomplete used for stability).
- Removed on-map Locate/search control.

What's new
----------
- Admin: single-line Business Address input with Places autocomplete and a formatted viewer.

 

Changed
-------
- Larger legend icons for better readability.
- Improved vendor list: larger icons, bigger text, and more consistent spacing.
- Removed the on-map search control to simplify the interface.
- Admin: vendor logos now appear on the map instantly when you enter a logo URL.

Bug fixes
---------
- Admin: deleting a booth now immediately removes all its map overlays without needing to refresh the page.

Known bugs
----------
- Google's newer PlaceAutocompleteElement is inconsistent across certain Maps SDK builds. We currently use the legacy `google.maps.places.Autocomplete` for the admin address field; this is fully supported. We'll revisit migration when the newer element behaves consistently.

Developer notes
---------------
Developer-focused technical notes have been moved to `RELEASE_NOTES/DEVELOPER_NOTES.md` — please maintain detailed per-release entries there.

How to release
--------------
- Copy this file to `RELEASE_NOTES/vX.Y.Z.md`, set the version/date, and clear or archive `UNRELEASED.md`.
