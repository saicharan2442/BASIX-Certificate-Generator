BASIX CERTIFICATE ARTWORK — DROP THE TWO IMAGES IN THIS FOLDER
================================================================

1. certificate-blank.png    (REQUIRED)
   The BASIX certificate background WITHOUT any student details on it.
   Ideal size: 1536 x 1024 px (3:2), PNG or JPG.
   (certificate-blank.jpg / .jpeg are also detected automatically.)

2. certificate-sample.png   (OPTIONAL)
   The completed certificate with sample student details.
   Only used as a semi-transparent comparison overlay in the
   Layout Settings editor, to fine-tune text positions.

After adding the files, rebuild/reload the app:
  npm run build      (or during development: just reload npm run dev)

If the files are missing, the app still works but shows an explicit
"TEMPLATE PLACEHOLDER" background instead. You can also upload the two
images inside the app at any time: Layout Settings -> Template.
