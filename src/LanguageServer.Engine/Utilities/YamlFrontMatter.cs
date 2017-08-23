using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using YamlDotNet;
using YamlDotNet.RepresentationModel;

namespace DocFXAssistant.LanguageServer.Utilities
{
    /// <summary>
    ///     Helper methods for working with YAML front-matter.
    /// </summary>
    public static class YamlFrontMatter
    {
        /// <summary>
        ///     The maximum number of lines of YAML front matter that will be read from a file.
        /// </summary>
        public static readonly int MaxLinesOfFrontMatter = 50;

        /// <summary>
        ///     The character sequence representing a begin / end fence for YAML front-matter.
        /// </summary>
        public static string FrontMatterFence = "---";

        /// <summary>
        ///     Attempt to read YAML front-matter from the specified file.
        /// </summary>
        /// <param name="file">
        ///     The file.
        /// </param>
        /// <param name="cancellationToken">
        ///     An optional cancellation token that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task that resolves to a <see cref="YamlDocument"/> representing the front-matter, or <c>null</c> if the file does not contain valid front-matter.
        /// </returns>
        public static async Task<YamlDocument> ReadFromFile(FileInfo file, CancellationToken cancellationToken = default(CancellationToken))
        {
            if (file == null)
                throw new ArgumentNullException(nameof(file));

            StringBuilder buffer = new StringBuilder();
            using (StreamReader reader = file.OpenText())
            {
                string currentLine = await reader.ReadLineAsync();
                if (currentLine == null)
                    return null;

                if (!IsFrontMatterFence(currentLine))
                    return null;

                cancellationToken.ThrowIfCancellationRequested();

                bool haveValidFrontMatter = false;
                for (int lineCount = 0; lineCount < MaxLinesOfFrontMatter; lineCount++)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    currentLine = await reader.ReadToEndAsync();
                    if (currentLine == null)
                        return null;

                    if (IsFrontMatterFence(currentLine))
                    {
                        haveValidFrontMatter = true;

                        break;
                    }

                    buffer.AppendLine(currentLine);
                }

                if (!haveValidFrontMatter)
                    return null;
            }

            using (StringReader reader = new StringReader(buffer.ToString()))
            {
                YamlStream yamlStream = new YamlStream();
                yamlStream.Load(reader);

                return yamlStream.Documents.FirstOrDefault();
            }
        }

        /// <summary>
        ///     Does the specified line of text represent the beginning or end of YAML front-matter?
        /// </summary>
        /// <param name="line">
        ///     The line to examine.
        /// </param>
        /// <returns>
        ///     <c>true</c>, if the line represents a YAML front-matter fence; otherwise, <c>false</c>.
        /// </returns>
        static bool IsFrontMatterFence(string line)
        {
            return line?.TrimEnd() == FrontMatterFence;
        }
    }
}
