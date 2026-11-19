import Foundation
import Vision
import AppKit

let dir = CommandLine.arguments[1]
let files = try FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".png") }.sorted()
var out: [String: [String: Double]] = [:]
for name in files {
    guard let image = NSImage(contentsOfFile: dir + "/" + name),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hant", "en-US"]
    request.usesLanguageCorrection = false
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try? handler.perform([request])
    var chars = 0.0, area = 0.0, boxes = 0.0
    for obs in request.results ?? [] {
        guard let top = obs.topCandidates(1).first, top.confidence >= 0.5 else { continue }
        chars += Double(top.string.count); boxes += 1
        area += Double(obs.boundingBox.width * obs.boundingBox.height)
    }
    out[String(name.dropLast(4))] = ["chars": chars, "area": area, "boxes": boxes]
}
let data = try JSONSerialization.data(withJSONObject: out)
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
print("done", out.count)
