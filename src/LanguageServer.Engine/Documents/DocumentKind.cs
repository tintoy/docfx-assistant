namespace DocFXAssistant.LanguageServer.Documents
{
    /// <summary>
    ///     A kind of <see cref="Document"/>.
    /// </summary>
    public enum DocumentKind
    {
        /// <summary>
        ///     A markdown (.md) file.
        /// </summary>
        Markdown = 1,

        /// <summary>
        ///     A managed reference (.yml) file.
        /// </summary>
        ManagedReference = 2,

        /// <summary>
        ///     A table-of-contents (.yml) file.
        /// </summary>
        TOC = 3
    }
}
