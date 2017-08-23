using System;
using System.Threading;
using System.Threading.Tasks;
using Serilog;

namespace DocFXAssistant.LanguageServer.Documents
{
    /// <summary>
    ///     A Markdown document in a DocFX project.
    /// </summary>
    public class MarkdownDocument
        : Document
    {
        /// <summary>
        ///     Create a new <see cref="Document"/>.
        /// </summary>
        /// <param name="workspace">
        ///     The document workspace.
        /// </param>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <param name="logger">
        ///     The application logger.
        /// </param>
        protected MarkdownDocument(Workspace workspace, Uri documentUri, ILogger logger)
            : base(workspace, documentUri, logger)
        {
        }

        /// <summary>
        ///     The kind of document (e.g. Markdown, ManagedReference, etc).
        /// </summary>
        public override DocumentKind Kind => DocumentKind.Markdown;
    }
}
