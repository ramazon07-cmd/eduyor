"""Supported mentoring directions; preserve names and IDs used by existing profiles."""

SUBJECT_NAMES = ('SAT', 'IELTS', 'Mathematics', 'University Admissions', 'International Programs', 'Chinese')
SUBJECT_LABELS = {
    'Mathematics': 'Matematika',
    'University Admissions': 'Admissions',
    'International Programs': 'International Programs',
    'Chinese': 'Xitoy tili',
}

# The directory accepts the subject labels displayed in all three UI languages.
SUBJECT_SEARCH_LABELS = {
    'Mathematics': ('Matematika', 'Mathematics', 'Математика'),
    'University Admissions': ('Admissions', 'Поступление'),
    'International Programs': ('International Programs', 'Международные программы'),
    'Chinese': ('Xitoy tili', 'Chinese', 'Китайский язык'),
}
